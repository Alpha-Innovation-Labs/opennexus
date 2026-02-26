use anyhow::{Context, Result};
use rusqlite::params;

use super::connection::now_epoch;
use super::{OrchestrationStore, StepAttemptPersistence};

impl OrchestrationStore {
    pub fn persist_step_attempt_with_traces(&self, record: &StepAttemptPersistence) -> Result<i64> {
        self.in_transaction("step attempt + trace persistence", |conn| {
            conn.execute(
                "INSERT INTO orchestration_step_attempts (
                    run_id, step_id, attempt_index, status, details, terminal_reason,
                    step_input_json, step_output_json, started_at, finished_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    record.run_id,
                    record.step_id,
                    record.attempt_index,
                    record.status,
                    record.details,
                    record.terminal_reason,
                    record.step_input_json,
                    record.step_output_json,
                    now_epoch(),
                    now_epoch(),
                ],
            )
            .with_context(|| {
                format!(
                    "Failed to persist step attempt (run_id={}, step='{}').",
                    record.run_id, record.step_id
                )
            })?;
            let step_attempt_id = conn.last_insert_rowid();

            for trace in &record.traces {
                conn.execute(
                    "INSERT INTO orchestration_traces (
                        run_id, step_id, attempt_index, step_attempt_id, model, prompt_payload, response_payload,
                        status, terminal_status, latency_ms, token_usage, artifact_refs_json, created_at
                    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                    params![
                        record.run_id,
                        trace.step_id,
                        trace.attempt_index,
                        step_attempt_id,
                        trace.model,
                        trace.prompt,
                        trace.response,
                        trace.status,
                        trace.terminal_status,
                        trace.latency_ms,
                        trace.token_usage,
                        trace.artifact_refs_json,
                        now_epoch(),
                    ],
                )
                .with_context(|| {
                    format!(
                        "Failed to persist trace (run_id={}, step='{}').",
                        record.run_id, trace.step_id
                    )
                })?;
            }

            Ok(step_attempt_id)
        })
    }

    pub(super) fn list_trace_ids_for_step_attempt(&self, step_attempt_id: i64) -> Result<Vec<i64>> {
        let mut stmt = self
            .connection
            .prepare(
                "SELECT id FROM orchestration_traces
                 WHERE step_attempt_id=?1 ORDER BY id ASC",
            )
            .context("Failed preparing trace id lookup by step attempt.")?;
        let rows = stmt.query_map(params![step_attempt_id], |row| row.get(0))?;
        Ok(rows.filter_map(Result::ok).collect())
    }
}
