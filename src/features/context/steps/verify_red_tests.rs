use anyhow::{Context, Result};

use crate::adapters::orchestration_store::{
    default_orchestration_database_path, OrchestrationStore, RedTestClassificationRecord,
};
use crate::features::context::pipeline::{StepContract, StepOutcome, WorkflowStep};
use crate::features::context::reporting::{log_stage_result, log_stage_start};
use crate::features::context::steps::support::classify_generated_red_tests;
use crate::features::context::workflow_state::{ContextWorkflowState, StepContext, WorkflowEvent};

pub(crate) struct VerifyRedTestsStep;

impl WorkflowStep for VerifyRedTestsStep {
    fn id(&self) -> &'static str {
        "verify_red_tests"
    }

    fn run(&self, state: &mut ContextWorkflowState, ctx: &StepContext) -> Result<StepOutcome> {
        let runner_plan = state
            .runner_plan
            .as_ref()
            .context("Runner plan missing in workflow state")?;

        log_stage_start("red_test_verifier", 0, &ctx.options.context_file);
        let classifications = classify_generated_red_tests(
            &state.generated_files,
            runner_plan,
            &ctx.options.red_failure_patterns,
        )?;

        let non_behavioral = classifications
            .iter()
            .filter(|record| !record.is_behavioral)
            .map(|record| {
                format!(
                    "{}: {} (hint: {})",
                    record.test_id, record.reason, record.remediation_hint
                )
            })
            .collect::<Vec<String>>();

        if non_behavioral.is_empty() {
            log_stage_result(
                "red_test_verifier",
                true,
                "generated tests are failing as expected (red phase)",
            );
        } else {
            log_stage_result(
                "red_test_verifier",
                false,
                &format!("non_behavioral_failures={}", non_behavioral.join(" | ")),
            );
        }

        if let Some(run_id) = ctx.options.run_id {
            let store = OrchestrationStore::open(&default_orchestration_database_path())?;
            let records = classifications
                .iter()
                .map(|record| RedTestClassificationRecord {
                    test_id: record.test_id.clone(),
                    category: record.category.clone(),
                    reason: record.reason.clone(),
                    remediation_hint: record.remediation_hint.clone(),
                    is_behavioral: record.is_behavioral,
                })
                .collect::<Vec<RedTestClassificationRecord>>();
            store.persist_red_test_classifications(run_id, &records)?;
        }

        if !non_behavioral.is_empty() {
            anyhow::bail!(
                "Red gate blocked: non-behavioral failures detected. {}",
                non_behavioral.join(" | ")
            );
        }

        state.events.push(WorkflowEvent {
            step_id: self.id().to_string(),
            message: "red tests verified".to_string(),
        });
        Ok(StepOutcome::Continue)
    }

    fn requires(&self) -> &'static [StepContract] {
        &[StepContract::RunnerPlan, StepContract::GeneratedScaffold]
    }

    fn provides(&self) -> &'static [StepContract] {
        &[StepContract::RedTestsVerified]
    }
}
