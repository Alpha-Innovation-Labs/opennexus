use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::time::Instant;

use crate::core::context::model::{ContextLoopOutcome, ContextParseResult};
use crate::features::context::test_runner::TestRunnerPlan;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct GeneratedTestFile {
    pub path: PathBuf,
    pub test_id: String,
    pub description: String,
}

#[derive(Debug)]
pub(crate) struct ContextWorkflowState {
    pub started_at: Instant,
    pub parsed: Option<ContextParseResult>,
    pub discovered_rule_files: Vec<PathBuf>,
    pub selected_rule: Option<PathBuf>,
    pub runner_plan: Option<TestRunnerPlan>,
    pub generated_files: Vec<GeneratedTestFile>,
    pub current_iteration: usize,
    pub last_validation_passed: bool,
    pub terminal_outcome: Option<ContextLoopOutcome>,
    pub events: Vec<WorkflowEvent>,
    pub agent_conversations: Vec<AgentConversationRecord>,
    pub completed_step_ids: Vec<String>,
    pub failed_step_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub(crate) struct WorkflowCheckpoint {
    pub parsed: Option<ContextParseResult>,
    pub discovered_rule_files: Vec<PathBuf>,
    pub selected_rule: Option<PathBuf>,
    pub runner_plan: Option<TestRunnerPlan>,
    pub generated_files: Vec<GeneratedTestFile>,
    pub current_iteration: usize,
    pub last_validation_passed: bool,
    pub terminal_outcome: Option<ContextLoopOutcome>,
    pub events: Vec<WorkflowEvent>,
    pub agent_conversations: Vec<AgentConversationRecord>,
    pub completed_step_ids: Vec<String>,
    pub failed_step_id: Option<String>,
}

impl ContextWorkflowState {
    pub(crate) fn new() -> Self {
        Self {
            started_at: Instant::now(),
            parsed: None,
            discovered_rule_files: Vec::new(),
            selected_rule: None,
            runner_plan: None,
            generated_files: Vec::new(),
            current_iteration: 0,
            last_validation_passed: false,
            terminal_outcome: None,
            events: Vec::new(),
            agent_conversations: Vec::new(),
            completed_step_ids: Vec::new(),
            failed_step_id: None,
        }
    }

    pub(crate) fn to_checkpoint(&self) -> WorkflowCheckpoint {
        WorkflowCheckpoint {
            parsed: self.parsed.clone(),
            discovered_rule_files: self.discovered_rule_files.clone(),
            selected_rule: self.selected_rule.clone(),
            runner_plan: self.runner_plan.clone(),
            generated_files: self.generated_files.clone(),
            current_iteration: self.current_iteration,
            last_validation_passed: self.last_validation_passed,
            terminal_outcome: self.terminal_outcome,
            events: self.events.clone(),
            agent_conversations: self.agent_conversations.clone(),
            completed_step_ids: self.completed_step_ids.clone(),
            failed_step_id: self.failed_step_id.clone(),
        }
    }

    pub(crate) fn apply_checkpoint(&mut self, checkpoint: WorkflowCheckpoint) {
        self.parsed = checkpoint.parsed;
        self.discovered_rule_files = checkpoint.discovered_rule_files;
        self.selected_rule = checkpoint.selected_rule;
        self.runner_plan = checkpoint.runner_plan;
        self.generated_files = checkpoint.generated_files;
        self.current_iteration = checkpoint.current_iteration;
        self.last_validation_passed = checkpoint.last_validation_passed;
        self.terminal_outcome = checkpoint.terminal_outcome;
        self.events = checkpoint.events;
        self.agent_conversations = checkpoint.agent_conversations;
        self.completed_step_ids = checkpoint.completed_step_ids;
        self.failed_step_id = checkpoint.failed_step_id;
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowEvent {
    pub step_id: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConversationRecord {
    pub stage: String,
    pub prompt: String,
    pub stdout: String,
    pub stderr: String,
    pub success: bool,
    #[serde(default)]
    pub latency_ms: i64,
    #[serde(default)]
    pub terminal_status: String,
    #[serde(default)]
    pub model_id: String,
    #[serde(default)]
    pub estimated_token_usage: i64,
}

pub(crate) struct StepContext<'a> {
    pub options: &'a crate::core::context::model::ContextImplementOptions,
}
