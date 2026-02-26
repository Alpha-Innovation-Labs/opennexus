use anyhow::{Context, Result};
use rusqlite::params;

use super::{OrchestrationStore, TraceQueryRow};

impl OrchestrationStore {
    pub fn list_traces_for_run(
        &self,
        run_id: i64,
    ) -> Result<Vec<(i64, String, i64, String, i64, i64, String)>> {
        let mut stmt = self
            .connection
            .prepare(
                "SELECT id, step_id, attempt_index, status, latency_ms, token_usage, model
                 FROM orchestration_traces WHERE run_id=?1 ORDER BY id ASC",
            )
            .context("Failed preparing trace listing query.")?;
        let rows = stmt.query_map(params![run_id], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
                row.get(6)?,
            ))
        })?;
        Ok(rows.filter_map(Result::ok).collect())
    }

    pub fn query_traces_for_run(&self, run_id: i64) -> Result<Vec<TraceQueryRow>> {
        let mut stmt = self
            .connection
            .prepare(
                "SELECT id, run_id, step_attempt_id, step_id, attempt_index, model,
                        prompt_payload, response_payload, status, terminal_status,
                        latency_ms, token_usage, artifact_refs_json
                 FROM orchestration_traces WHERE run_id=?1 ORDER BY id ASC",
            )
            .context("Failed preparing structured trace query.")?;
        let rows = stmt.query_map(params![run_id], |row| {
            let refs_json = row
                .get::<_, Option<String>>(12)?
                .unwrap_or_else(|| "[]".to_string());
            let artifact_refs = serde_json::from_str::<Vec<String>>(&refs_json).unwrap_or_default();
            Ok(TraceQueryRow {
                trace_id: row.get(0)?,
                run_id: row.get(1)?,
                step_attempt_id: row.get(2)?,
                step_id: row.get(3)?,
                attempt_index: row.get(4)?,
                model: row.get(5)?,
                prompt_payload: row.get(6)?,
                response_payload: row.get(7)?,
                status: row.get(8)?,
                terminal_status: row.get(9)?,
                latency_ms: row.get(10)?,
                token_usage: row.get(11)?,
                artifact_refs,
            })
        })?;
        Ok(rows.filter_map(Result::ok).collect())
    }
}
