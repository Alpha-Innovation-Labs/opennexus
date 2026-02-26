use anyhow::{Context, Result};
use rusqlite::params;

use super::connection::now_epoch;
use super::next_actions::reconcile_next_actions_tx;
use super::{ContextNextAction, NextActionReconciliationSummary, OrchestrationStore, RunRecord};

impl OrchestrationStore {
    pub fn create_run(
        &self,
        pipeline_name: &str,
        context_id: &str,
        context_file: &str,
        fingerprint: &str,
        overwrite: bool,
        supersedes_run_id: Option<i64>,
        runner_pid: Option<i64>,
    ) -> Result<i64> {
        self.connection
            .execute(
                "INSERT INTO orchestration_runs (
                    pipeline_name, context_id, context_file, run_fingerprint, status, terminal_reason,
                    overwrite_requested, supersedes_run_id, runner_pid, started_at, finished_at
                 ) VALUES (?1, ?2, ?3, ?4, 'running', NULL, ?5, ?6, ?7, ?8, NULL)",
                params![
                    pipeline_name,
                    context_id,
                    context_file,
                    fingerprint,
                    overwrite as i64,
                    supersedes_run_id,
                    runner_pid,
                    now_epoch()
                ],
            )
            .with_context(|| {
                format!(
                    "Failed to create orchestration run record (pipeline='{}', context_id='{}').",
                    pipeline_name, context_id
                )
            })?;
        Ok(self.connection.last_insert_rowid())
    }

    pub fn create_run_with_snapshot_and_actions(
        &self,
        pipeline_name: &str,
        context_id: &str,
        context_file: &str,
        fingerprint: &str,
        overwrite: bool,
        supersedes_run_id: Option<i64>,
        runner_pid: Option<i64>,
        snapshot_hash: &str,
        snapshot_json: &str,
        next_actions: &[ContextNextAction],
    ) -> Result<(i64, NextActionReconciliationSummary)> {
        self.in_transaction(
            "create run + context snapshot + next action reconciliation",
            |conn| {
                conn.execute(
                    "INSERT INTO orchestration_runs (
                    pipeline_name, context_id, context_file, run_fingerprint, status, terminal_reason,
                    overwrite_requested, supersedes_run_id, runner_pid, started_at, finished_at
                 ) VALUES (?1, ?2, ?3, ?4, 'running', NULL, ?5, ?6, ?7, ?8, NULL)",
                    params![
                        pipeline_name,
                        context_id,
                        context_file,
                        fingerprint,
                        overwrite as i64,
                        supersedes_run_id,
                        runner_pid,
                        now_epoch(),
                    ],
                )
                .with_context(|| {
                    format!(
                        "Failed to create orchestration run record (pipeline='{}', context_id='{}').",
                        pipeline_name, context_id
                    )
                })?;
                let run_id = conn.last_insert_rowid();

                conn.execute(
                    "INSERT INTO orchestration_context_snapshots (run_id, context_id, snapshot_hash, snapshot_json)
                 VALUES (?1, ?2, ?3, ?4)",
                    params![run_id, context_id, snapshot_hash, snapshot_json],
                )
                .with_context(|| {
                    format!(
                        "Failed to persist context snapshot for run {} and context_id='{}'.",
                        run_id, context_id
                    )
                })?;

                let summary = reconcile_next_actions_tx(conn, run_id, context_id, next_actions)?;
                Ok((run_id, summary))
            },
        )
    }

    pub fn finish_run(
        &self,
        run_id: i64,
        status: &str,
        terminal_reason: Option<&str>,
    ) -> Result<()> {
        self.connection
            .execute(
                "UPDATE orchestration_runs SET status=?1, terminal_reason=?2, finished_at=?3 WHERE id=?4 AND status='running'",
                params![status, terminal_reason, now_epoch(), run_id],
            )
            .with_context(|| {
                format!(
                    "Failed to finalize orchestration run {} with status '{}'.",
                    run_id, status
                )
            })?;
        Ok(())
    }

    pub fn find_successful_run_by_fingerprint(
        &self,
        fingerprint: &str,
    ) -> Result<Option<(i64, i64)>> {
        let mut stmt = self
            .connection
            .prepare(
                "SELECT id, finished_at FROM orchestration_runs
                 WHERE run_fingerprint=?1 AND status='success'
                 ORDER BY id DESC LIMIT 1",
            )
            .context("Failed preparing fingerprint dedupe query.")?;
        let mut rows = stmt
            .query(params![fingerprint])
            .context("Failed executing fingerprint dedupe query.")?;
        if let Some(row) = rows.next()? {
            return Ok(Some((row.get(0)?, row.get(1)?)));
        }
        Ok(None)
    }

    pub fn latest_run_for_context(
        &self,
        context_file: &str,
    ) -> Result<Option<(i64, String, String, Option<String>, Option<i64>, i64)>> {
        let mut stmt = self
            .connection
            .prepare(
                "SELECT id, pipeline_name, status, terminal_reason, finished_at, started_at
                 FROM orchestration_runs WHERE context_file=?1 ORDER BY id DESC LIMIT 1",
            )
            .context("Failed preparing latest run query.")?;
        let mut rows = stmt.query(params![context_file]).with_context(|| {
            format!("Failed querying latest run for context '{}'.", context_file)
        })?;
        if let Some(row) = rows.next()? {
            return Ok(Some((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
            )));
        }
        Ok(None)
    }

    pub fn list_active_runs_for_context(
        &self,
        context_file: &str,
        pipeline_filter: Option<&str>,
    ) -> Result<Vec<i64>> {
        let (sql, params_vec): (&str, Vec<rusqlite::types::Value>) = if let Some(filter) =
            pipeline_filter
        {
            (
                "SELECT id FROM orchestration_runs WHERE context_file=?1 AND status='running' AND pipeline_name=?2 ORDER BY id DESC",
                vec![
                    rusqlite::types::Value::Text(context_file.to_string()),
                    rusqlite::types::Value::Text(filter.to_string()),
                ],
            )
        } else {
            (
                "SELECT id FROM orchestration_runs WHERE context_file=?1 AND status='running' ORDER BY id DESC",
                vec![rusqlite::types::Value::Text(context_file.to_string())],
            )
        };
        let mut stmt = self
            .connection
            .prepare(sql)
            .context("Failed preparing active run query.")?;
        let rows = stmt.query_map(rusqlite::params_from_iter(params_vec.iter()), |row| {
            row.get(0)
        })?;
        Ok(rows.filter_map(Result::ok).collect())
    }

    pub fn stop_active_run_for_context(
        &self,
        context_file: &str,
        pipeline_filter: Option<&str>,
        terminal_reason: &str,
    ) -> Result<Option<(i64, String, Option<i64>)>> {
        self.in_transaction("stop active run", |conn| {
            let (sql, params_vec): (&str, Vec<rusqlite::types::Value>) =
                if let Some(filter) = pipeline_filter {
                    (
                        "SELECT id, pipeline_name, runner_pid FROM orchestration_runs WHERE context_file=?1 AND status='running' AND pipeline_name=?2 ORDER BY id DESC LIMIT 1",
                        vec![
                            rusqlite::types::Value::Text(context_file.to_string()),
                            rusqlite::types::Value::Text(filter.to_string()),
                        ],
                    )
                } else {
                    (
                        "SELECT id, pipeline_name, runner_pid FROM orchestration_runs WHERE context_file=?1 AND status='running' ORDER BY id DESC LIMIT 1",
                        vec![rusqlite::types::Value::Text(context_file.to_string())],
                    )
                };

            let mut stmt = conn
                .prepare(sql)
                .context("Failed preparing stop query for active run.")?;
            let mut rows = stmt
                .query(rusqlite::params_from_iter(params_vec.iter()))
                .context("Failed executing stop query for active run.")?;
            let Some(row) = rows.next()? else {
                return Ok(None);
            };
            let run_id: i64 = row.get(0)?;
            let pipeline_name: String = row.get(1)?;
            let runner_pid: Option<i64> = row.get(2)?;

            conn.execute(
                "UPDATE orchestration_runs SET status='stopped', terminal_reason=?1, finished_at=?2 WHERE id=?3 AND status='running'",
                params![terminal_reason, now_epoch(), run_id],
            )
            .with_context(|| format!("Failed to mark run {} as stopped.", run_id))?;

            Ok(Some((run_id, pipeline_name, runner_pid)))
        })
    }

    pub fn list_runs_for_context(
        &self,
        context_file: &str,
    ) -> Result<Vec<(i64, String, String, Option<String>, i64, Option<i64>)>> {
        let mut stmt = self
            .connection
            .prepare(
                "SELECT id, pipeline_name, status, terminal_reason, started_at, finished_at
                 FROM orchestration_runs WHERE context_file=?1 ORDER BY id DESC",
            )
            .context("Failed preparing run listing query.")?;
        let rows = stmt.query_map(params![context_file], |row| {
            Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
                row.get(4)?,
                row.get(5)?,
            ))
        })?;
        Ok(rows.filter_map(Result::ok).collect())
    }

    pub fn run_exists(&self, run_id: i64) -> Result<bool> {
        let mut stmt = self
            .connection
            .prepare("SELECT 1 FROM orchestration_runs WHERE id=?1 LIMIT 1")
            .context("Failed preparing run existence query.")?;
        let mut rows = stmt
            .query(params![run_id])
            .with_context(|| format!("Failed checking run existence for id {}.", run_id))?;
        Ok(rows.next()?.is_some())
    }

    pub fn get_run_by_id(&self, run_id: i64) -> Result<Option<RunRecord>> {
        let mut stmt = self
            .connection
            .prepare(
                "SELECT id, pipeline_name, context_file, status, terminal_reason, started_at, finished_at FROM orchestration_runs WHERE id=?1 LIMIT 1",
            )
            .context("Failed preparing run detail query.")?;
        let mut rows = stmt
            .query(params![run_id])
            .with_context(|| format!("Failed querying run details for id {}.", run_id))?;
        if let Some(row) = rows.next()? {
            return Ok(Some(RunRecord {
                run_id: row.get(0)?,
                pipeline_name: row.get(1)?,
                context_file: row.get(2)?,
                status: row.get(3)?,
                terminal_reason: row.get(4)?,
                started_at: row.get(5)?,
                finished_at: row.get(6)?,
            }));
        }
        Ok(None)
    }
}
