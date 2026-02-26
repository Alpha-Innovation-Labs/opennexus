use anyhow::{bail, Context, Result};

use super::checkpoint::load_checkpoint;
use super::pipeline::WorkflowPipeline;
use super::steps::{
    CoderIterationStep, DependencyGateStep, DiscoverAndSelectRuleStep, GenerateScaffoldStep,
    ParseContextStep, RedTestAuthorStep, ResolveTestRunnerStep, VerifyRedTestsStep,
    VerifyTestDiscoveryStep,
};
use super::workflow_state::{ContextWorkflowState, StepContext};
use crate::core::context::model::ContextImplementOptions;

pub(crate) fn run_context_implement(options: &ContextImplementOptions) -> Result<()> {
    let mut state = ContextWorkflowState::new();
    let ctx = StepContext { options };
    let pipeline = build_pipeline(options.pipeline_steps.as_deref())?;

    let start_index = if let Some(resume_path) = &options.resume_checkpoint {
        let checkpoint = load_checkpoint(resume_path)?;
        state.apply_checkpoint(checkpoint);
        resolve_resume_index(&pipeline, &state).with_context(|| {
            format!(
                "Unable to resume orchestration from checkpoint '{}'.",
                resume_path.display()
            )
        })?
    } else {
        0
    };

    let _ = if start_index == 0 {
        pipeline.run(&mut state, &ctx)?
    } else {
        pipeline.run_from(start_index, &mut state, &ctx)?
    };
    Ok(())
}

fn resolve_resume_index(
    pipeline: &WorkflowPipeline,
    state: &ContextWorkflowState,
) -> Result<usize> {
    if let Some(failed) = &state.failed_step_id {
        let idx = pipeline
            .step_ids()
            .iter()
            .position(|id| *id == failed)
            .ok_or_else(|| {
                anyhow::anyhow!("failed step '{}' not present in current pipeline", failed)
            })?;
        return Ok(idx);
    }
    Ok(state.completed_step_ids.len())
}

fn build_pipeline(step_ids: Option<&[String]>) -> Result<WorkflowPipeline> {
    let ordered_ids: Vec<String> = step_ids
        .map(|ids| ids.to_vec())
        .unwrap_or_else(default_pipeline_step_ids);

    let mut seen = std::collections::BTreeSet::<String>::new();
    for id in &ordered_ids {
        if !seen.insert(id.clone()) {
            bail!(
                "Pipeline contains duplicate step key '{}'. Step keys must be unique.",
                id
            );
        }
    }

    let mut steps = Vec::new();
    for id in ordered_ids {
        steps.push(build_step(&id)?);
    }
    let pipeline = WorkflowPipeline::new(steps);
    pipeline.validate_wiring()?;
    Ok(pipeline)
}

fn default_pipeline_step_ids() -> Vec<String> {
    vec![
        "parse_context".to_string(),
        "dependency_gate".to_string(),
        "discover_and_select_rule".to_string(),
        "resolve_test_runner".to_string(),
        "generate_scaffold".to_string(),
        "red_test_author".to_string(),
        "verify_test_discovery".to_string(),
        "verify_red_tests".to_string(),
        "coder_iteration".to_string(),
    ]
}

fn build_step(id: &str) -> Result<Box<dyn super::pipeline::WorkflowStep>> {
    match id {
        "parse_context" => Ok(Box::new(ParseContextStep)),
        "dependency_gate" => Ok(Box::new(DependencyGateStep)),
        "discover_and_select_rule" => Ok(Box::new(DiscoverAndSelectRuleStep)),
        "resolve_test_runner" => Ok(Box::new(ResolveTestRunnerStep)),
        "generate_scaffold" => Ok(Box::new(GenerateScaffoldStep)),
        "red_test_author" => Ok(Box::new(RedTestAuthorStep)),
        "verify_test_discovery" => Ok(Box::new(VerifyTestDiscoveryStep)),
        "verify_red_tests" => Ok(Box::new(VerifyRedTestsStep)),
        "coder_iteration" => Ok(Box::new(CoderIterationStep)),
        other => bail!("Unknown orchestration step '{}'.", other),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_pipeline_contains_expected_steps() {
        let ids = default_pipeline_step_ids();
        assert_eq!(ids.first().map(String::as_str), Some("parse_context"));
        assert_eq!(ids.last().map(String::as_str), Some("coder_iteration"));
    }
}
