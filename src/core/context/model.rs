use std::path::PathBuf;

#[derive(Debug, Clone)]
pub struct ContextImplementOptions {
    pub context_file: PathBuf,
    pub max_iterations: usize,
    pub timeout_seconds: u64,
    pub rule_file: Option<String>,
    pub test_command: Option<String>,
    pub test_discovery_command: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ContextTestStatusOptions {
    pub context_file: PathBuf,
    pub command_name: String,
}

#[derive(Debug, Clone)]
pub struct ContextBackfillOptions {
    pub context_file: Option<PathBuf>,
    pub all: bool,
}

#[derive(Debug, Clone)]
pub struct ContextParseResult {
    pub context_id: String,
    pub tests: Vec<String>,
    pub next_actions: Vec<ContextNextAction>,
    pub test_runner: Option<String>,
    pub language: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ContextNextAction {
    pub description: String,
    pub test_id: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ContextRunMode {
    Implement,
    Backfill,
}

impl ContextRunMode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Implement => "implement",
            Self::Backfill => "backfill",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ContextTaskStatus {
    Implemented,
    Failed,
    Missing,
}

impl ContextTaskStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Implemented => "implemented",
            Self::Failed => "failed",
            Self::Missing => "missing",
        }
    }
}

#[derive(Debug, Clone)]
pub struct BackfillTaskResult {
    pub test_id: String,
    pub status: ContextTaskStatus,
    pub details: Option<String>,
}

#[derive(Debug, Clone)]
pub struct BackfillContextResult {
    pub context_id: String,
    pub context_file: PathBuf,
    pub tasks: Vec<BackfillTaskResult>,
}

impl BackfillContextResult {
    pub fn implemented_count(&self) -> usize {
        self.tasks
            .iter()
            .filter(|task| task.status == ContextTaskStatus::Implemented)
            .count()
    }

    pub fn failed_count(&self) -> usize {
        self.tasks
            .iter()
            .filter(|task| task.status == ContextTaskStatus::Failed)
            .count()
    }

    pub fn missing_count(&self) -> usize {
        self.tasks
            .iter()
            .filter(|task| task.status == ContextTaskStatus::Missing)
            .count()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ContextLoopOutcome {
    Success,
    MaxIterationsReached,
    TimeoutReached,
}
