use anyhow::{Context, Result};
use rusqlite::params;

use super::OrchestrationStore;

impl OrchestrationStore {
    pub fn persist_context_snapshot(
        &self,
        run_id: i64,
        context_id: &str,
        snapshot_hash: &str,
        snapshot: &str,
    ) -> Result<()> {
        self.connection
            .execute(
                "INSERT INTO orchestration_context_snapshots (run_id, context_id, snapshot_hash, snapshot_json)
                 VALUES (?1, ?2, ?3, ?4)",
                params![run_id, context_id, snapshot_hash, snapshot],
            )
            .with_context(|| {
                format!(
                    "Failed to persist context snapshot for run {} and context_id='{}'.",
                    run_id, context_id
                )
            })?;
        Ok(())
    }

    pub fn latest_success_snapshot_hash(&self, context_id: &str) -> Result<Option<String>> {
        let mut stmt = self
            .connection
            .prepare(
                "SELECT s.snapshot_hash
                 FROM orchestration_context_snapshots s
                 JOIN orchestration_runs r ON r.id = s.run_id
                 WHERE s.context_id=?1 AND r.status='success'
                 ORDER BY s.id DESC LIMIT 1",
            )
            .context("Failed preparing latest successful snapshot query.")?;
        let mut rows = stmt.query(params![context_id]).with_context(|| {
            format!(
                "Failed querying latest successful snapshot for context_id='{}'.",
                context_id
            )
        })?;
        if let Some(row) = rows.next()? {
            return Ok(Some(row.get(0)?));
        }
        Ok(None)
    }

    pub fn mark_context_runs_stale(&self, context_id: &str, newest_hash: &str) -> Result<()> {
        self.connection
            .execute(
                "UPDATE orchestration_runs
                 SET status='stale', terminal_reason=?1
                 WHERE context_id=?2 AND status='success'",
                params![
                    format!(
                        "context snapshot drift detected; superseded by hash {}",
                        newest_hash
                    ),
                    context_id
                ],
            )
            .with_context(|| {
                format!(
                    "Failed to mark successful runs stale for context_id='{}'.",
                    context_id
                )
            })?;
        Ok(())
    }
}
