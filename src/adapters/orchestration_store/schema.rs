use anyhow::{Context, Result};
use rusqlite::Connection;

use super::OrchestrationStore;

impl OrchestrationStore {
    pub(super) fn initialize_schema(&self) -> Result<()> {
        self.connection.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS orchestration_schema_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            INSERT OR IGNORE INTO orchestration_schema_meta (key, value) VALUES ('schema_version', '2');

            CREATE TABLE IF NOT EXISTS orchestration_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pipeline_name TEXT NOT NULL,
                context_id TEXT NOT NULL,
                context_file TEXT NOT NULL,
                run_fingerprint TEXT NOT NULL,
                status TEXT NOT NULL,
                terminal_reason TEXT,
                overwrite_requested INTEGER NOT NULL,
                supersedes_run_id INTEGER,
                runner_pid INTEGER,
                started_at INTEGER NOT NULL,
                finished_at INTEGER
            );

            CREATE TABLE IF NOT EXISTS orchestration_step_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL,
                step_id TEXT NOT NULL,
                attempt_index INTEGER NOT NULL,
                status TEXT NOT NULL,
                details TEXT,
                terminal_reason TEXT,
                step_input_json TEXT,
                step_output_json TEXT,
                started_at INTEGER NOT NULL,
                finished_at INTEGER NOT NULL,
                FOREIGN KEY(run_id) REFERENCES orchestration_runs(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS orchestration_context_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL,
                context_id TEXT NOT NULL,
                snapshot_hash TEXT NOT NULL,
                snapshot_json TEXT NOT NULL,
                FOREIGN KEY(run_id) REFERENCES orchestration_runs(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS orchestration_traces (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL,
                step_id TEXT NOT NULL,
                attempt_index INTEGER NOT NULL,
                step_attempt_id INTEGER,
                model TEXT NOT NULL,
                prompt_payload TEXT NOT NULL,
                response_payload TEXT NOT NULL,
                status TEXT NOT NULL,
                terminal_status TEXT,
                latency_ms INTEGER NOT NULL,
                token_usage INTEGER NOT NULL,
                artifact_refs_json TEXT,
                created_at INTEGER NOT NULL,
                FOREIGN KEY(run_id) REFERENCES orchestration_runs(id) ON DELETE CASCADE,
                FOREIGN KEY(step_attempt_id) REFERENCES orchestration_step_attempts(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS orchestration_red_test_classifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL,
                test_id TEXT NOT NULL,
                category TEXT NOT NULL,
                reason TEXT NOT NULL,
                remediation_hint TEXT,
                is_behavioral INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                FOREIGN KEY(run_id) REFERENCES orchestration_runs(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS orchestration_artifacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL,
                step_id TEXT NOT NULL,
                artifact_kind TEXT NOT NULL,
                artifact_ref TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY(run_id) REFERENCES orchestration_runs(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS orchestration_next_action_snapshots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL,
                context_id TEXT NOT NULL,
                action_key TEXT NOT NULL,
                test_id TEXT NOT NULL,
                description TEXT NOT NULL,
                normalized_payload TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                FOREIGN KEY(run_id) REFERENCES orchestration_runs(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS orchestration_next_action_lifecycle (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL,
                context_id TEXT NOT NULL,
                action_key TEXT NOT NULL,
                lifecycle_state TEXT NOT NULL,
                reason TEXT,
                created_at INTEGER NOT NULL,
                FOREIGN KEY(run_id) REFERENCES orchestration_runs(id) ON DELETE CASCADE
            );
            ",
        )?;

        self.run_migrations_if_needed()?;
        Ok(())
    }

    fn run_migrations_if_needed(&self) -> Result<()> {
        ensure_column(
            &self.connection,
            "orchestration_step_attempts",
            "terminal_reason",
            "TEXT",
        )?;
        ensure_column(
            &self.connection,
            "orchestration_step_attempts",
            "step_input_json",
            "TEXT",
        )?;
        ensure_column(
            &self.connection,
            "orchestration_step_attempts",
            "step_output_json",
            "TEXT",
        )?;
        ensure_column(
            &self.connection,
            "orchestration_traces",
            "step_attempt_id",
            "INTEGER",
        )?;
        ensure_column(
            &self.connection,
            "orchestration_traces",
            "terminal_status",
            "TEXT",
        )?;
        ensure_column(
            &self.connection,
            "orchestration_traces",
            "artifact_refs_json",
            "TEXT",
        )?;
        ensure_column(
            &self.connection,
            "orchestration_red_test_classifications",
            "remediation_hint",
            "TEXT",
        )?;
        ensure_column(
            &self.connection,
            "orchestration_red_test_classifications",
            "is_behavioral",
            "INTEGER NOT NULL DEFAULT 0",
        )?;
        ensure_column(
            &self.connection,
            "orchestration_runs",
            "runner_pid",
            "INTEGER",
        )?;

        self.connection.execute(
            "INSERT OR REPLACE INTO orchestration_schema_meta (key, value) VALUES ('schema_version', '2')",
            [],
        )?;
        Ok(())
    }
}

fn ensure_column(
    conn: &Connection,
    table: &str,
    column: &str,
    column_definition: &str,
) -> Result<()> {
    let mut stmt = conn
        .prepare(&format!("PRAGMA table_info({})", table))
        .with_context(|| format!("Failed to inspect schema for table '{}'.", table))?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
    for existing in rows.filter_map(Result::ok) {
        if existing == column {
            return Ok(());
        }
    }
    conn.execute(
        &format!(
            "ALTER TABLE {} ADD COLUMN {} {}",
            table, column, column_definition
        ),
        [],
    )
    .with_context(|| {
        format!(
            "Failed applying schema migration: add column '{}.{}'.",
            table, column
        )
    })?;
    Ok(())
}
