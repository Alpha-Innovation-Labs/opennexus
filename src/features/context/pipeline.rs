use anyhow::{Context, Result};
use serde_json::{json, Map, Value};

use super::checkpoint::save_checkpoint;
use super::workflow_state::{ContextWorkflowState, StepContext};
use crate::adapters::orchestration_store::{
    default_orchestration_database_path, OrchestrationStore, StepAttemptPersistence,
    TraceRecordInput,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum StepOutcome {
    Continue,
    Stop,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub(crate) enum StepContract {
    ParsedContext,
    DependencyGatePassed,
    SelectedRule,
    RunnerPlan,
    GeneratedScaffold,
    RedTestsAuthored,
    TestDiscoveryVerified,
    RedTestsVerified,
    TerminalOutcome,
}

impl StepContract {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::ParsedContext => "parsed_context",
            Self::DependencyGatePassed => "dependency_gate_passed",
            Self::SelectedRule => "selected_rule",
            Self::RunnerPlan => "runner_plan",
            Self::GeneratedScaffold => "generated_scaffold",
            Self::RedTestsAuthored => "red_tests_authored",
            Self::TestDiscoveryVerified => "test_discovery_verified",
            Self::RedTestsVerified => "red_tests_verified",
            Self::TerminalOutcome => "terminal_outcome",
        }
    }
}

pub(crate) trait WorkflowStep {
    fn id(&self) -> &'static str;
    fn run(&self, state: &mut ContextWorkflowState, ctx: &StepContext) -> Result<StepOutcome>;
    fn requires(&self) -> &'static [StepContract] {
        &[]
    }
    fn provides(&self) -> &'static [StepContract] {
        &[]
    }
}

pub(crate) struct WorkflowPipeline {
    steps: Vec<Box<dyn WorkflowStep>>,
}

impl WorkflowPipeline {
    pub(crate) fn new(steps: Vec<Box<dyn WorkflowStep>>) -> Self {
        Self { steps }
    }

    pub(crate) fn run(
        &self,
        state: &mut ContextWorkflowState,
        ctx: &StepContext,
    ) -> Result<StepOutcome> {
        self.run_from(0, state, ctx)
    }

    pub(crate) fn step_ids(&self) -> Vec<&'static str> {
        self.steps.iter().map(|step| step.id()).collect()
    }

    pub(crate) fn validate_wiring(&self) -> Result<()> {
        let mut available = std::collections::BTreeSet::<StepContract>::new();
        for step in &self.steps {
            for req in step.requires() {
                if !available.contains(req) {
                    anyhow::bail!(
                        "Pipeline wiring invalid: step '{}' requires '{}' before it is produced.",
                        step.id(),
                        req.as_str()
                    );
                }
            }
            for out in step.provides() {
                available.insert(*out);
            }
        }
        Ok(())
    }

    pub(crate) fn run_from(
        &self,
        start_index: usize,
        state: &mut ContextWorkflowState,
        ctx: &StepContext,
    ) -> Result<StepOutcome> {
        for step in self.steps.iter().skip(start_index) {
            let step_id = step.id();
            let step_input_json = step_io_snapshot_json(state, step.requires());
            let conversations_before = state.agent_conversations.len();
            let outcome = match step.run(state, ctx) {
                Ok(outcome) => outcome,
                Err(err) => {
                    state.failed_step_id = Some(step_id.to_string());
                    let step_output_json = step_io_snapshot_json(state, step.provides());
                    persist_step_attempt_and_traces(
                        ctx,
                        state,
                        step_id,
                        "failed",
                        &err.to_string(),
                        Some(err.to_string()),
                        &step_input_json,
                        &step_output_json,
                        conversations_before,
                    )
                    .with_context(|| {
                        format!(
                            "Failed to persist failed attempt for step '{}' to orchestration store.",
                            step_id
                        )
                    })?;

                    if let Some(checkpoint_path) = &ctx.options.checkpoint_file {
                        let _ = save_checkpoint(checkpoint_path, &state.to_checkpoint());
                    }
                    return Err(err).with_context(|| {
                        format!(
                            "Pipeline step '{}' failed. To resume, rerun from this step after fixing the cause.",
                            step_id
                        )
                    });
                }
            };

            state.completed_step_ids.push(step_id.to_string());
            let step_output_json = step_io_snapshot_json(state, step.provides());
            persist_step_attempt_and_traces(
                ctx,
                state,
                step_id,
                "success",
                "completed",
                None,
                &step_input_json,
                &step_output_json,
                conversations_before,
            )
            .with_context(|| {
                format!(
                    "Failed to persist successful attempt for step '{}' to orchestration store.",
                    step_id
                )
            })?;

            if let Some(checkpoint_path) = &ctx.options.checkpoint_file {
                save_checkpoint(checkpoint_path, &state.to_checkpoint())?;
            }
            if outcome == StepOutcome::Stop {
                return Ok(StepOutcome::Stop);
            }
        }
        Ok(StepOutcome::Continue)
    }
}

fn persist_step_attempt_and_traces(
    ctx: &StepContext,
    state: &ContextWorkflowState,
    step_id: &str,
    status: &str,
    details: &str,
    terminal_reason: Option<String>,
    step_input_json: &str,
    step_output_json: &str,
    start_index: usize,
) -> Result<()> {
    let Some(run_id) = ctx.options.run_id else {
        return Ok(());
    };

    let store = OrchestrationStore::open(&default_orchestration_database_path())
        .context("Unable to open orchestration store while persisting step attempts.")?;
    let artifact_refs = store.list_artifact_refs_for_step(run_id, step_id)?;
    let artifact_refs_json =
        serde_json::to_string(&artifact_refs).unwrap_or_else(|_| "[]".to_string());

    let traces = build_trace_records(state, step_id, start_index, &artifact_refs_json);

    store.persist_step_attempt_with_traces(&StepAttemptPersistence {
        run_id,
        step_id: step_id.to_string(),
        attempt_index: 1,
        status: status.to_string(),
        details: details.to_string(),
        terminal_reason,
        step_input_json: step_input_json.to_string(),
        step_output_json: step_output_json.to_string(),
        traces,
    })?;
    Ok(())
}

fn build_trace_records(
    state: &ContextWorkflowState,
    step_id: &str,
    start_index: usize,
    artifact_refs_json: &str,
) -> Vec<TraceRecordInput> {
    state
        .agent_conversations
        .iter()
        .skip(start_index)
        .map(|conversation| {
            let response = format!("{}\n{}", conversation.stdout, conversation.stderr);
            TraceRecordInput {
                step_id: step_id.to_string(),
                attempt_index: 1,
                model: conversation.model_id.clone(),
                prompt: conversation.prompt.clone(),
                response,
                status: if conversation.success {
                    "success".to_string()
                } else {
                    "failed".to_string()
                },
                latency_ms: conversation.latency_ms.max(1),
                token_usage: conversation.estimated_token_usage.max(1),
                terminal_status: conversation.terminal_status.clone(),
                artifact_refs_json: artifact_refs_json.to_string(),
            }
        })
        .collect::<Vec<TraceRecordInput>>()
}

fn step_io_snapshot_json(state: &ContextWorkflowState, contracts: &[StepContract]) -> String {
    let mut payload = Map::<String, Value>::new();
    for contract in contracts {
        let key = contract.as_str().to_string();
        let value = match contract {
            StepContract::ParsedContext => state
                .parsed
                .as_ref()
                .map(|v| serde_json::to_value(v).unwrap_or(Value::Null))
                .unwrap_or(Value::Null),
            StepContract::DependencyGatePassed => {
                let passed = state.events.iter().any(|event| {
                    event.step_id == "dependency_gate" && event.message.contains("satisfied")
                });
                json!(passed)
            }
            StepContract::SelectedRule => state
                .selected_rule
                .as_ref()
                .map(|v| Value::String(v.display().to_string()))
                .unwrap_or(Value::Null),
            StepContract::RunnerPlan => state
                .runner_plan
                .as_ref()
                .map(|v| serde_json::to_value(v).unwrap_or(Value::Null))
                .unwrap_or(Value::Null),
            StepContract::GeneratedScaffold => {
                serde_json::to_value(&state.generated_files).unwrap_or(Value::Null)
            }
            StepContract::RedTestsAuthored => {
                let authored = state
                    .events
                    .iter()
                    .any(|event| event.step_id == "red_test_author");
                json!(authored)
            }
            StepContract::TestDiscoveryVerified => {
                let verified = state
                    .events
                    .iter()
                    .any(|event| event.step_id == "verify_test_discovery");
                json!(verified)
            }
            StepContract::RedTestsVerified => {
                let verified = state
                    .events
                    .iter()
                    .any(|event| event.step_id == "verify_red_tests");
                json!(verified)
            }
            StepContract::TerminalOutcome => state
                .terminal_outcome
                .map(|value| format!("{:?}", value))
                .map(Value::String)
                .unwrap_or(Value::Null),
        };
        payload.insert(key, value);
    }
    Value::Object(payload).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::context::model::ContextImplementOptions;
    use crate::features::context::workflow_state::{AgentConversationRecord, ContextWorkflowState};
    use anyhow::bail;
    use std::cell::RefCell;
    use std::path::PathBuf;
    use std::rc::Rc;

    struct MockStep {
        name: &'static str,
        log: Rc<RefCell<Vec<&'static str>>>,
        stop: bool,
        fail: bool,
    }

    impl WorkflowStep for MockStep {
        fn id(&self) -> &'static str {
            self.name
        }

        fn run(
            &self,
            _state: &mut ContextWorkflowState,
            _ctx: &StepContext,
        ) -> Result<StepOutcome> {
            self.log.borrow_mut().push(self.name);
            if self.fail {
                bail!("mock step failure");
            }
            Ok(if self.stop {
                StepOutcome::Stop
            } else {
                StepOutcome::Continue
            })
        }
    }

    fn options() -> ContextImplementOptions {
        ContextImplementOptions {
            pipeline_name: "default".to_string(),
            context_file: PathBuf::from(".nexus/context/demo/ctx.md"),
            max_iterations: 1,
            timeout_seconds: 30,
            rule_file: None,
            test_command: None,
            test_discovery_command: None,
            agent_model: None,
            pipeline_steps: None,
            red_failure_patterns: vec!["syntaxerror".to_string()],
            checkpoint_file: None,
            resume_checkpoint: None,
            allow_dependency_bypass: false,
            overwrite: false,
            run_id: None,
        }
    }

    #[test]
    fn pipeline_executes_steps_in_order() {
        let log = Rc::new(RefCell::new(Vec::new()));
        let pipeline = WorkflowPipeline::new(vec![
            Box::new(MockStep {
                name: "a",
                log: Rc::clone(&log),
                stop: false,
                fail: false,
            }),
            Box::new(MockStep {
                name: "b",
                log: Rc::clone(&log),
                stop: false,
                fail: false,
            }),
        ]);
        let mut state = ContextWorkflowState::new();
        let opts = options();
        let ctx = StepContext { options: &opts };

        let outcome = pipeline.run(&mut state, &ctx).expect("pipeline should run");
        assert_eq!(outcome, StepOutcome::Continue);
        assert_eq!(&*log.borrow(), &vec!["a", "b"]);
    }

    #[test]
    fn pipeline_supports_composable_stop_step() {
        let log = Rc::new(RefCell::new(Vec::new()));
        let pipeline = WorkflowPipeline::new(vec![
            Box::new(MockStep {
                name: "first",
                log: Rc::clone(&log),
                stop: false,
                fail: false,
            }),
            Box::new(MockStep {
                name: "stopper",
                log: Rc::clone(&log),
                stop: true,
                fail: false,
            }),
            Box::new(MockStep {
                name: "never-runs",
                log: Rc::clone(&log),
                stop: false,
                fail: false,
            }),
        ]);
        let mut state = ContextWorkflowState::new();
        let opts = options();
        let ctx = StepContext { options: &opts };

        let outcome = pipeline.run(&mut state, &ctx).expect("pipeline should run");
        assert_eq!(outcome, StepOutcome::Stop);
        assert_eq!(&*log.borrow(), &vec!["first", "stopper"]);
    }

    #[test]
    fn pipeline_records_failed_step_for_resume() {
        let log = Rc::new(RefCell::new(Vec::new()));
        let pipeline = WorkflowPipeline::new(vec![
            Box::new(MockStep {
                name: "ok-step",
                log: Rc::clone(&log),
                stop: false,
                fail: false,
            }),
            Box::new(MockStep {
                name: "failing-step",
                log: Rc::clone(&log),
                stop: false,
                fail: true,
            }),
        ]);
        let mut state = ContextWorkflowState::new();
        let opts = options();
        let ctx = StepContext { options: &opts };

        let err = pipeline
            .run(&mut state, &ctx)
            .expect_err("pipeline should fail");
        assert!(err.to_string().contains("failing-step"));
        assert_eq!(state.failed_step_id.as_deref(), Some("failing-step"));
        assert_eq!(state.completed_step_ids, vec!["ok-step"]);
    }

    #[test]
    fn typed_contract_wiring_rejects_missing_inputs() {
        struct RequiresParsed;
        impl WorkflowStep for RequiresParsed {
            fn id(&self) -> &'static str {
                "requires"
            }
            fn run(
                &self,
                _state: &mut ContextWorkflowState,
                _ctx: &StepContext,
            ) -> Result<StepOutcome> {
                Ok(StepOutcome::Continue)
            }
            fn requires(&self) -> &'static [StepContract] {
                &[StepContract::ParsedContext]
            }
        }

        let pipeline = WorkflowPipeline::new(vec![Box::new(RequiresParsed)]);
        let err = pipeline.validate_wiring().expect_err("should fail wiring");
        assert!(err.to_string().contains("requires 'parsed_context'"));
    }

    #[test]
    fn trace_records_persist_measured_latency_and_non_zero_tokens() {
        let mut state = ContextWorkflowState::new();
        state.agent_conversations.push(AgentConversationRecord {
            stage: "coder".to_string(),
            prompt: "implement feature".to_string(),
            stdout: "done".to_string(),
            stderr: String::new(),
            success: true,
            latency_ms: 0,
            terminal_status: "success".to_string(),
            model_id: "opencode/default".to_string(),
            estimated_token_usage: 0,
        });

        let traces = build_trace_records(&state, "coder_iteration", 0, "[]");
        assert_eq!(traces.len(), 1);
        assert!(traces[0].latency_ms > 0);
        assert!(traces[0].token_usage > 0);
    }
}
