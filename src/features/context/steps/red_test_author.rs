use anyhow::{Context, Result};

use crate::features::context::pipeline::{StepContract, StepOutcome, WorkflowStep};
use crate::features::context::reporting::{log_stage_result, log_stage_start};
use crate::features::context::steps::support::{build_red_test_author_prompt, run_agent_stage};
use crate::features::context::workflow_state::{ContextWorkflowState, StepContext, WorkflowEvent};

pub(crate) struct RedTestAuthorStep;

impl WorkflowStep for RedTestAuthorStep {
    fn id(&self) -> &'static str {
        "red_test_author"
    }

    fn run(&self, state: &mut ContextWorkflowState, ctx: &StepContext) -> Result<StepOutcome> {
        let parsed = state
            .parsed
            .as_ref()
            .context("Parsed context missing in workflow state")?;
        let runner_plan = state
            .runner_plan
            .as_ref()
            .context("Runner plan missing in workflow state")?;

        log_stage_start("red_test_author", 0, &ctx.options.context_file);
        let prompt = build_red_test_author_prompt(
            &ctx.options.context_file,
            parsed,
            state.selected_rule.as_deref(),
            runner_plan,
            &state.generated_files,
        )?;
        let conversation = run_agent_stage(
            "red_test_author",
            &prompt,
            ctx.options.agent_model.as_deref(),
        )
        .with_context(|| {
            "red_test_author stage failed. Remediation: ensure OpenCode is installed/authenticated and retry."
        })?;
        log_stage_result(
            "red_test_author",
            true,
            "agent generated test content for scaffold files",
        );

        state.events.push(WorkflowEvent {
            step_id: self.id().to_string(),
            message: "completed red test authoring".to_string(),
        });
        state.agent_conversations.push(conversation);
        Ok(StepOutcome::Continue)
    }

    fn requires(&self) -> &'static [StepContract] {
        &[
            StepContract::ParsedContext,
            StepContract::RunnerPlan,
            StepContract::GeneratedScaffold,
        ]
    }

    fn provides(&self) -> &'static [StepContract] {
        &[StepContract::RedTestsAuthored]
    }
}
