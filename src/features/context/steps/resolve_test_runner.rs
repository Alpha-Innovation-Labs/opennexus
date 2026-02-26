use anyhow::{Context, Result};
use std::path::Path;

use crate::features::context::pipeline::{StepContract, StepOutcome, WorkflowStep};
use crate::features::context::test_runner::resolve_test_runner_plan;
use crate::features::context::workflow_state::{ContextWorkflowState, StepContext, WorkflowEvent};

pub(crate) struct ResolveTestRunnerStep;

impl WorkflowStep for ResolveTestRunnerStep {
    fn id(&self) -> &'static str {
        "resolve_test_runner"
    }

    fn run(&self, state: &mut ContextWorkflowState, ctx: &StepContext) -> Result<StepOutcome> {
        let parsed = state
            .parsed
            .as_ref()
            .context("Parsed context missing in workflow state")?;

        let runner_plan = resolve_test_runner_plan(
            Path::new("."),
            parsed,
            state.selected_rule.as_deref(),
            ctx.options.test_command.as_deref(),
            ctx.options.test_discovery_command.as_deref(),
        )?;

        println!(
            "Resolved test runner: source={}, toolchain={}, verify='{}'{}",
            runner_plan.source.as_str(),
            runner_plan.toolchain.as_str(),
            runner_plan.verify_command_template,
            runner_plan
                .discovery_command
                .as_ref()
                .map(|cmd| format!(", discovery='{}'", cmd))
                .unwrap_or_default(),
        );
        println!(
            "Resolver signals: {}",
            runner_plan.detected_signals.join(", ")
        );
        println!(
            "Resolver attempts: {}",
            runner_plan.attempted_sources.join("; ")
        );

        state.events.push(WorkflowEvent {
            step_id: self.id().to_string(),
            message: format!("resolved runner {}", runner_plan.verify_command_template),
        });
        state.runner_plan = Some(runner_plan);
        Ok(StepOutcome::Continue)
    }

    fn requires(&self) -> &'static [StepContract] {
        &[StepContract::ParsedContext]
    }

    fn provides(&self) -> &'static [StepContract] {
        &[StepContract::RunnerPlan]
    }
}
