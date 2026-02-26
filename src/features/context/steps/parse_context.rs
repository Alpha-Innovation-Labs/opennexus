use anyhow::Result;

use crate::features::context::parser::parse_context_file;
use crate::features::context::pipeline::{StepContract, StepOutcome, WorkflowStep};
use crate::features::context::reporting::{log_stage_result, log_stage_start};
use crate::features::context::workflow_state::{ContextWorkflowState, StepContext, WorkflowEvent};

pub(crate) struct ParseContextStep;

impl WorkflowStep for ParseContextStep {
    fn id(&self) -> &'static str {
        "parse_context"
    }

    fn run(&self, state: &mut ContextWorkflowState, ctx: &StepContext) -> Result<StepOutcome> {
        log_stage_start("context_loader", 0, &ctx.options.context_file);
        let parsed = parse_context_file(&ctx.options.context_file)?;
        log_stage_result(
            "context_loader",
            true,
            &format!(
                "context_id={}, tests={}",
                parsed.context_id,
                parsed.tests.len()
            ),
        );
        state.events.push(WorkflowEvent {
            step_id: self.id().to_string(),
            message: format!("parsed {} tests", parsed.tests.len()),
        });
        state.parsed = Some(parsed);
        Ok(StepOutcome::Continue)
    }

    fn provides(&self) -> &'static [StepContract] {
        &[StepContract::ParsedContext]
    }
}
