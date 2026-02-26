use anyhow::{bail, Context, Result};
use serde::Deserialize;
use std::fs;

use crate::adapters::orchestration_store::{
    default_orchestration_database_path, OrchestrationStore,
};
use crate::features::context::pipeline::{StepContract, StepOutcome, WorkflowStep};
use crate::features::context::workflow_state::{ContextWorkflowState, StepContext, WorkflowEvent};

#[derive(Debug, Deserialize, Default)]
struct FrontmatterDependsOn {
    #[serde(default)]
    contexts: Vec<String>,
    #[serde(default)]
    projects: Vec<String>,
}

#[derive(Debug, Deserialize, Default)]
struct FrontmatterRoot {
    #[serde(default)]
    depends_on: FrontmatterDependsOn,
}

pub(crate) struct DependencyGateStep;

impl WorkflowStep for DependencyGateStep {
    fn id(&self) -> &'static str {
        "dependency_gate"
    }

    fn run(&self, state: &mut ContextWorkflowState, ctx: &StepContext) -> Result<StepOutcome> {
        let content = fs::read_to_string(&ctx.options.context_file).with_context(|| {
            format!(
                "Unable to read context file '{}' for dependency gate.",
                ctx.options.context_file.display()
            )
        })?;
        let Some(frontmatter) = extract_frontmatter(&content) else {
            return Ok(StepOutcome::Continue);
        };
        let parsed: FrontmatterRoot = serde_yaml::from_str(frontmatter).with_context(|| {
            format!(
                "Invalid frontmatter in '{}' while parsing depends_on.",
                ctx.options.context_file.display()
            )
        })?;
        if parsed.depends_on.contexts.is_empty() && parsed.depends_on.projects.is_empty() {
            return Ok(StepOutcome::Continue);
        }

        if ctx.options.allow_dependency_bypass {
            println!("Dependency gate bypass enabled; continuing despite depends_on requirements.");
            state.events.push(WorkflowEvent {
                step_id: self.id().to_string(),
                message: "dependency bypass enabled".to_string(),
            });
            return Ok(StepOutcome::Continue);
        }

        let store = OrchestrationStore::open(&default_orchestration_database_path())?;
        let unmet = evaluate_dependencies(&store, parsed.depends_on)?;

        if !unmet.is_empty() {
            bail!(
                "Execution blocked by unresolved dependencies: {}. Use --allow-dependency-bypass to override intentionally.",
                unmet.join(", ")
            );
        }

        state.events.push(WorkflowEvent {
            step_id: self.id().to_string(),
            message: "all dependencies satisfied".to_string(),
        });
        Ok(StepOutcome::Continue)
    }

    fn requires(&self) -> &'static [StepContract] {
        &[StepContract::ParsedContext]
    }

    fn provides(&self) -> &'static [StepContract] {
        &[StepContract::DependencyGatePassed]
    }
}

fn evaluate_dependencies(
    store: &OrchestrationStore,
    depends_on: FrontmatterDependsOn,
) -> Result<Vec<String>> {
    let mut unmet = Vec::new();
    for context_id in depends_on.contexts {
        if store.latest_success_for_context_id(&context_id)?.is_none() {
            unmet.push(format!("context:{}", context_id));
        }
    }
    for project_reference in depends_on.projects {
        let resolved_project = store
            .resolve_project_reference(&project_reference)
            .map_err(|err| {
                anyhow::anyhow!(
                    "Invalid depends_on.projects entry '{}': {}",
                    project_reference,
                    err
                )
            })?;
        if store
            .latest_success_for_project(&resolved_project)?
            .is_none()
        {
            unmet.push(format!(
                "project:{} (no successful runs found for this project yet)",
                resolved_project
            ));
        }
    }
    Ok(unmet)
}

fn extract_frontmatter(content: &str) -> Option<&str> {
    let trimmed = content.trim_start();
    if !trimmed.starts_with("---") {
        return None;
    }
    let rest = &trimmed[3..];
    let end = rest.find("\n---")?;
    Some(rest[..end].trim())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn temp_store() -> OrchestrationStore {
        let db_path = std::env::temp_dir().join(format!(
            "dependency-gate-test-{}-{}.sqlite",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("unix epoch")
                .as_nanos()
        ));
        let _ = std::fs::remove_file(&db_path);
        OrchestrationStore::open(&db_path).expect("open store")
    }

    #[test]
    fn project_dependency_is_satisfied_by_successful_project_run() {
        let store = temp_store();
        let run_id = store
            .create_run(
                "default",
                "ORC_007",
                ".nexus/context/nexus-cli/orchestration/ORC_007.md",
                "fp",
                false,
                None,
                None,
            )
            .expect("run");
        store
            .finish_run(run_id, "success", None)
            .expect("finish run");

        let unmet = evaluate_dependencies(
            &store,
            FrontmatterDependsOn {
                contexts: Vec::new(),
                projects: vec!["nexus-cli".to_string()],
            },
        )
        .expect("dependency check");
        assert!(unmet.is_empty());
    }

    #[test]
    fn dependency_gate_reports_actionable_invalid_project_reference() {
        let store = temp_store();
        let err = evaluate_dependencies(
            &store,
            FrontmatterDependsOn {
                contexts: Vec::new(),
                projects: vec!["unknown-project".to_string()],
            },
        )
        .expect_err("invalid project should fail");
        assert!(err
            .to_string()
            .contains("Invalid depends_on.projects entry 'unknown-project'"));
    }

    #[test]
    fn dependency_gate_reports_actionable_ambiguous_project_reference() {
        let store = temp_store();
        let run_a = store
            .create_run(
                "default",
                "CWB_001",
                ".nexus/context/cdd-web-ui/workspace/CWB_001.md",
                "fp-a",
                false,
                None,
                None,
            )
            .expect("run a");
        store.finish_run(run_a, "success", None).expect("finish a");
        let run_b = store
            .create_run(
                "default",
                "CORE_001",
                ".nexus/context/cdd-web-core/runtime/CORE_001.md",
                "fp-b",
                false,
                None,
                None,
            )
            .expect("run b");
        store.finish_run(run_b, "success", None).expect("finish b");

        let err = evaluate_dependencies(
            &store,
            FrontmatterDependsOn {
                contexts: Vec::new(),
                projects: vec!["cdd-web".to_string()],
            },
        )
        .expect_err("ambiguous project should fail");
        assert!(err
            .to_string()
            .contains("Ambiguous project dependency 'cdd-web'"));
    }

    #[test]
    fn frontmatter_extract_returns_none_without_markers() {
        let content = "# no frontmatter";
        assert!(extract_frontmatter(content).is_none());
    }

    #[test]
    fn dependency_gate_step_id_is_stable() {
        let step = DependencyGateStep;
        assert_eq!(step.id(), "dependency_gate");
        let _ = PathBuf::from(".");
    }
}
