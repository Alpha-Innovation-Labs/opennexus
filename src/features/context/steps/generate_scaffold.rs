use anyhow::{Context, Result};

use crate::adapters::orchestration_store::{
    default_orchestration_database_path, OrchestrationStore,
};
use crate::features::context::pipeline::{StepContract, StepOutcome, WorkflowStep};
use crate::features::context::reporting::{log_stage_result, log_stage_start};
use crate::features::context::steps::support::{
    derive_context_test_output_dir, generate_test_scaffold,
};
use crate::features::context::workflow_state::{ContextWorkflowState, StepContext, WorkflowEvent};

pub(crate) struct GenerateScaffoldStep;

impl WorkflowStep for GenerateScaffoldStep {
    fn id(&self) -> &'static str {
        "generate_scaffold"
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

        log_stage_start("test_generator", 0, &ctx.options.context_file);
        let generated_files =
            generate_test_scaffold(&ctx.options.context_file, parsed, runner_plan.toolchain)?;
        log_stage_result(
            "test_generator",
            true,
            &format!(
                "generated_files={} output_dir={}",
                generated_files.len(),
                derive_context_test_output_dir(&ctx.options.context_file)
                    .map(|path| path.display().to_string())
                    .unwrap_or_else(|_| "tests".to_string())
            ),
        );

        state.events.push(WorkflowEvent {
            step_id: self.id().to_string(),
            message: format!("generated {} files", generated_files.len()),
        });

        if let Some(run_id) = ctx.options.run_id {
            let store = OrchestrationStore::open(&default_orchestration_database_path())?;
            let artifacts = generated_files
                .iter()
                .map(|file| ("test_file", file.path.display().to_string()))
                .collect::<Vec<(&str, String)>>();
            store.persist_artifacts_batch(run_id, self.id(), &artifacts)?;
        }

        state.generated_files = generated_files;
        Ok(StepOutcome::Continue)
    }

    fn requires(&self) -> &'static [StepContract] {
        &[StepContract::ParsedContext, StepContract::RunnerPlan]
    }

    fn provides(&self) -> &'static [StepContract] {
        &[StepContract::GeneratedScaffold]
    }
}
