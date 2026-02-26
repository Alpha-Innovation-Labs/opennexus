use anyhow::{Context, Result};
use std::path::Path;

use crate::features::context::pipeline::{StepContract, StepOutcome, WorkflowStep};
use crate::features::context::rules::{discover_rule_files, select_rule_file};
use crate::features::context::steps::support::infer_rule_request;
use crate::features::context::workflow_state::{ContextWorkflowState, StepContext, WorkflowEvent};

pub(crate) struct DiscoverAndSelectRuleStep;

impl WorkflowStep for DiscoverAndSelectRuleStep {
    fn id(&self) -> &'static str {
        "discover_and_select_rule"
    }

    fn run(&self, state: &mut ContextWorkflowState, ctx: &StepContext) -> Result<StepOutcome> {
        let parsed = state
            .parsed
            .as_ref()
            .context("Parsed context missing in workflow state")?;
        let discovered_rule_files = discover_rule_files(Path::new(".nexus/ai_harness/rules"))?;
        state.discovered_rule_files = discovered_rule_files.clone();
        println!("Discovered coding rule files:");
        if discovered_rule_files.is_empty() {
            println!("- (none)");
        } else {
            for file in &discovered_rule_files {
                println!("- {}", file.display());
            }
        }

        let inferred_rule = infer_rule_request(
            &discovered_rule_files,
            parsed,
            &ctx.options.context_file,
            ctx.options.rule_file.is_none(),
        )?;
        let selected_rule = select_rule_file(
            &discovered_rule_files,
            ctx.options
                .rule_file
                .as_deref()
                .or(inferred_rule.as_deref()),
        )?;
        if let Some(rule) = &selected_rule {
            println!("Selected coding rule: {}", rule.display());
        } else {
            println!("No coding rule selected (none discovered). Continuing.");
        }

        state.events.push(WorkflowEvent {
            step_id: self.id().to_string(),
            message: selected_rule
                .as_ref()
                .map(|p| format!("selected rule {}", p.display()))
                .unwrap_or_else(|| "selected no rule".to_string()),
        });
        state.selected_rule = selected_rule;
        Ok(StepOutcome::Continue)
    }

    fn requires(&self) -> &'static [StepContract] {
        &[StepContract::ParsedContext]
    }

    fn provides(&self) -> &'static [StepContract] {
        &[StepContract::SelectedRule]
    }
}
