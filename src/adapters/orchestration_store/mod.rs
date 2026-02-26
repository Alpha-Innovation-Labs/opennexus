use rusqlite::Connection;
use serde::Serialize;

mod artifacts;
mod connection;
mod dependencies;
mod next_actions;
mod red_test_classifications;
mod runs;
mod schema;
mod snapshots;
mod step_attempts;
mod timeline;
mod traces;

#[cfg(test)]
mod tests;

pub use connection::default_orchestration_database_path;

use crate::core::context::model::ContextNextAction;

#[derive(Debug, Clone)]
pub struct TraceRecordInput {
    pub step_id: String,
    pub attempt_index: i64,
    pub model: String,
    pub prompt: String,
    pub response: String,
    pub status: String,
    pub latency_ms: i64,
    pub token_usage: i64,
    pub terminal_status: String,
    pub artifact_refs_json: String,
}

#[derive(Debug, Clone)]
pub struct StepAttemptPersistence {
    pub run_id: i64,
    pub step_id: String,
    pub attempt_index: i64,
    pub status: String,
    pub details: String,
    pub terminal_reason: Option<String>,
    pub step_input_json: String,
    pub step_output_json: String,
    pub traces: Vec<TraceRecordInput>,
}

#[derive(Debug, Clone)]
pub struct RedTestClassificationRecord {
    pub test_id: String,
    pub category: String,
    pub reason: String,
    pub remediation_hint: String,
    pub is_behavioral: bool,
}

#[derive(Debug, Clone, Default)]
pub struct TimelineFilter {
    pub run_id: Option<i64>,
    pub context_id: Option<String>,
    pub context_file: Option<String>,
    pub pipeline_name: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TimelineRow {
    pub run_id: i64,
    pub context_id: String,
    pub context_file: String,
    pub pipeline_name: String,
    pub run_status: String,
    pub step_attempt_id: i64,
    pub step_id: String,
    pub attempt_index: i64,
    pub step_status: String,
    pub terminal_reason: Option<String>,
    pub started_at: i64,
    pub finished_at: i64,
    pub trace_ids: Vec<i64>,
    pub artifact_refs: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TraceQueryRow {
    pub trace_id: i64,
    pub run_id: i64,
    pub step_attempt_id: Option<i64>,
    pub step_id: String,
    pub attempt_index: i64,
    pub model: String,
    pub prompt_payload: String,
    pub response_payload: String,
    pub status: String,
    pub terminal_status: Option<String>,
    pub latency_ms: i64,
    pub token_usage: i64,
    pub artifact_refs: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct RunRecord {
    pub run_id: i64,
    pub pipeline_name: String,
    pub context_file: String,
    pub status: String,
    pub terminal_reason: Option<String>,
    pub started_at: i64,
    pub finished_at: Option<i64>,
}

#[derive(Debug, Clone)]
pub struct NextActionReconciliationSummary {
    pub added_pending: usize,
    pub removed_cancelled: usize,
    pub retained_active: usize,
}

pub struct OrchestrationStore {
    connection: Connection,
}
