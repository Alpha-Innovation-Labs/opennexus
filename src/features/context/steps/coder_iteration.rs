use anyhow::{Context, Result};
use std::time::Duration;

use crate::core::context::model::ContextLoopOutcome;
use crate::features::context::pipeline::{StepContract, StepOutcome, WorkflowStep};
use crate::features::context::reporting::{
    log_stage_result, log_stage_start, print_terminal_summary,
};
use crate::features::context::steps::support::{
    build_coder_prompt, run_agent_stage, validate_generated_tests,
};
use crate::features::context::workflow_state::{ContextWorkflowState, StepContext, WorkflowEvent};

pub(crate) struct CoderIterationStep;

impl WorkflowStep for CoderIterationStep {
    fn id(&self) -> &'static str {
        "coder_iteration"
    }

    fn run(&self, state: &mut ContextWorkflowState, ctx: &StepContext) -> Result<StepOutcome> {
        let parsed = state
            .parsed
            .as_ref()
            .context("Parsed context missing in workflow state")?
            .clone();
        let runner_plan = state
            .runner_plan
            .as_ref()
            .context("Runner plan missing in workflow state")?
            .clone();

        let timeout = Duration::from_secs(ctx.options.timeout_seconds);
        for iteration in 1..=ctx.options.max_iterations {
            state.current_iteration = iteration;
            if state.started_at.elapsed() >= timeout {
                state.terminal_outcome = Some(ContextLoopOutcome::TimeoutReached);
                print_terminal_summary(
                    ContextLoopOutcome::TimeoutReached,
                    iteration.saturating_sub(1),
                    &parsed.tests,
                );
                return Ok(StepOutcome::Stop);
            }

            log_stage_start("coder", iteration, &ctx.options.context_file);
            let coder_prompt = build_coder_prompt(
                &ctx.options.context_file,
                &parsed,
                state.selected_rule.as_deref(),
                &runner_plan,
                iteration,
                ctx.options.max_iterations,
            )?;
            let conversation = run_agent_stage(
                "coder",
                &coder_prompt,
                ctx.options.agent_model.as_deref(),
            )
            .with_context(|| {
                "coder stage failed. Remediation: ensure OpenCode is installed/authenticated and retry; use --rule-file to disambiguate coding constraints if needed."
            })?;
            state.agent_conversations.push(conversation);
            log_stage_result("coder", true, "agent invocation completed");

            log_stage_start(
                "implementation_validator",
                iteration,
                &ctx.options.context_file,
            );
            match validate_generated_tests(&parsed.tests, &runner_plan) {
                Ok(true) => {
                    log_stage_result("implementation_validator", true, "all target tests passed");
                    state.last_validation_passed = true;
                    state.terminal_outcome = Some(ContextLoopOutcome::Success);
                    print_terminal_summary(ContextLoopOutcome::Success, iteration, &parsed.tests);
                    state.events.push(WorkflowEvent {
                        step_id: self.id().to_string(),
                        message: format!("success on iteration {}", iteration),
                    });
                    return Ok(StepOutcome::Stop);
                }
                Ok(false) => {
                    log_stage_result(
                        "implementation_validator",
                        false,
                        "tests still failing; continuing loop",
                    );
                }
                Err(err) => {
                    log_stage_result(
                        "implementation_validator",
                        false,
                        "unable to execute test validation",
                    );
                    return Err(err).context(
                        "implementation_validator stage failed. Remediation: run the resolved test command manually and retry (or override with --test-command).",
                    );
                }
            }
        }

        state.terminal_outcome = Some(ContextLoopOutcome::MaxIterationsReached);
        print_terminal_summary(
            ContextLoopOutcome::MaxIterationsReached,
            ctx.options.max_iterations,
            &parsed.tests,
        );
        state.events.push(WorkflowEvent {
            step_id: self.id().to_string(),
            message: "max iterations reached".to_string(),
        });
        Ok(StepOutcome::Stop)
    }

    fn requires(&self) -> &'static [StepContract] {
        &[
            StepContract::ParsedContext,
            StepContract::RunnerPlan,
            StepContract::RedTestsVerified,
        ]
    }

    fn provides(&self) -> &'static [StepContract] {
        &[StepContract::TerminalOutcome]
    }
}
