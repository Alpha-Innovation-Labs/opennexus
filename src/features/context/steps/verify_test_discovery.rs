use anyhow::{bail, Context, Result};

use crate::features::context::pipeline::{StepContract, StepOutcome, WorkflowStep};
use crate::features::context::reporting::{log_stage_result, log_stage_start};
use crate::features::context::test_runner::{discover_tests_with_plan, missing_tests};
use crate::features::context::workflow_state::{ContextWorkflowState, StepContext, WorkflowEvent};

pub(crate) struct VerifyTestDiscoveryStep;

impl WorkflowStep for VerifyTestDiscoveryStep {
    fn id(&self) -> &'static str {
        "verify_test_discovery"
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

        log_stage_start("test_verifier", 0, &ctx.options.context_file);
        if let Some(discovered) = discover_tests_with_plan(runner_plan)? {
            let missing = missing_tests(&parsed.tests, &discovered);
            if !missing.is_empty() {
                log_stage_result(
                    "test_verifier",
                    false,
                    &format!("missing_discovery={}", missing.join(", ")),
                );
                bail!(
                    "Generated tests are not discoverable: {}. Discovery command='{}'. Check test naming or pass --test-discovery-command explicitly.",
                    missing.join(", "),
                    runner_plan.discovery_command.as_deref().unwrap_or("<none>")
                );
            }
            log_stage_result("test_verifier", true, "all generated tests discoverable");
        } else {
            log_stage_result(
                "test_verifier",
                true,
                "discovery command not configured; proceeding to direct test execution",
            );
        }

        state.events.push(WorkflowEvent {
            step_id: self.id().to_string(),
            message: "test discovery verified".to_string(),
        });
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
        &[StepContract::TestDiscoveryVerified]
    }
}
