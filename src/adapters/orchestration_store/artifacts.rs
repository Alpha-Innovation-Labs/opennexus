use anyhow::{Context, Result};
use rusqlite::params;

use super::connection::now_epoch;
use super::OrchestrationStore;

impl OrchestrationStore {
    pub fn persist_artifact(
        &self,
        run_id: i64,
        step_id: &str,
        artifact_kind: &str,
        artifact_ref: &str,
    ) -> Result<()> {
        self.connection
            .execute(
                "INSERT INTO orchestration_artifacts (
                    run_id, step_id, artifact_kind, artifact_ref, created_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![run_id, step_id, artifact_kind, artifact_ref, now_epoch()],
            )
            .with_context(|| {
                format!(
                    "Failed to persist orchestration artifact (run_id={}, step='{}', kind='{}').",
                    run_id, step_id, artifact_kind
                )
            })?;
        Ok(())
    }

    pub fn persist_artifacts_batch(
        &self,
        run_id: i64,
        step_id: &str,
        artifacts: &[(&str, String)],
    ) -> Result<()> {
        self.in_transaction("artifact persistence batch", |conn| {
            for (kind, reference) in artifacts {
                conn.execute(
                    "INSERT INTO orchestration_artifacts (
                        run_id, step_id, artifact_kind, artifact_ref, created_at
                     ) VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![run_id, step_id, *kind, reference, now_epoch()],
                )
                .with_context(|| {
                    format!(
                        "Failed to persist orchestration artifact (run_id={}, step='{}', kind='{}', ref='{}').",
                        run_id, step_id, kind, reference
                    )
                })?;
            }
            Ok(())
        })
    }

    pub fn list_artifacts_for_run(
        &self,
        run_id: i64,
    ) -> Result<Vec<(i64, String, String, String, i64)>> {
        let mut stmt = self
            .connection
            .prepare(
                "SELECT id, step_id, artifact_kind, artifact_ref, created_at
                 FROM orchestration_artifacts WHERE run_id=?1 ORDER BY id ASC",
            )
            .context("Failed preparing artifact listing query.")?;
        let rows = stmt.query_map(params![run_id], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
            ))
        })?;
        Ok(rows.filter_map(Result::ok).collect())
    }

    pub fn list_artifact_refs_for_step(&self, run_id: i64, step_id: &str) -> Result<Vec<String>> {
        let mut stmt = self
            .connection
            .prepare(
                "SELECT artifact_ref FROM orchestration_artifacts
                 WHERE run_id=?1 AND step_id=?2 ORDER BY id ASC",
            )
            .context("Failed preparing step artifact reference query.")?;
        let rows = stmt.query_map(params![run_id, step_id], |row| row.get(0))?;
        Ok(rows.filter_map(Result::ok).collect())
    }
}
