use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum AgentType {
    Opencode,
    ClaudeCode,
    Codex,
    Copilot,
}

impl AgentType {
    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "opencode" => Some(Self::Opencode),
            "claude-code" => Some(Self::ClaudeCode),
            "codex" => Some(Self::Codex),
            "copilot" => Some(Self::Copilot),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Opencode => "opencode",
            Self::ClaudeCode => "claude-code",
            Self::Codex => "codex",
            Self::Copilot => "copilot",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RotationEntry {
    pub agent: AgentType,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RalphState {
    pub active: bool,
    pub iteration: usize,
    pub min_iterations: usize,
    pub max_iterations: usize,
    pub completion_promise: String,
    pub abort_promise: String,
    pub tasks_mode: bool,
    pub task_promise: String,
    pub prompt: String,
    pub prompt_template: String,
    pub started_at: String,
    pub model: String,
    pub agent: AgentType,
    pub rotation: Vec<RotationEntry>,
    pub rotation_index: usize,
    pub auto_commit: bool,
    pub disable_plugins: bool,
    pub allow_all_permissions: bool,
    pub stream_output: bool,
    pub verbose_tools: bool,
    pub extra_agent_flags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IterationHistory {
    pub iteration: usize,
    pub started_at: String,
    pub ended_at: String,
    pub duration_ms: u128,
    pub agent: AgentType,
    pub model: String,
    pub tools_used: BTreeMap<String, usize>,
    pub files_modified: Vec<String>,
    pub exit_code: i32,
    pub completion_detected: bool,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct StruggleIndicators {
    pub repeated_errors: BTreeMap<String, usize>,
    pub no_progress_iterations: usize,
    pub short_iterations: usize,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RalphHistory {
    pub iterations: Vec<IterationHistory>,
    pub total_duration_ms: u128,
    pub struggle_indicators: StruggleIndicators,
}

#[derive(Debug, Clone)]
pub struct ParsedRunOptions {
    pub prompt: String,
    pub prompt_source: String,
    pub min_iterations: usize,
    pub max_iterations: usize,
    pub completion_promise: String,
    pub abort_promise: String,
    pub tasks_mode: bool,
    pub task_promise: String,
    pub model: String,
    pub agent: AgentType,
    pub rotation: Vec<RotationEntry>,
    pub prompt_template: String,
    pub stream_output: bool,
    pub verbose_tools: bool,
    pub auto_commit: bool,
    pub disable_plugins: bool,
    pub allow_all_permissions: bool,
    pub extra_agent_flags: Vec<String>,
}

#[derive(Debug, Clone)]
pub enum RalphOperation {
    Help,
    Version,
    Status { show_tasks: bool },
    AddContext { text: String },
    ClearContext,
    ListTasks,
    AddTask { description: String },
    RemoveTask { index: usize },
    Run(ParsedRunOptions),
}
