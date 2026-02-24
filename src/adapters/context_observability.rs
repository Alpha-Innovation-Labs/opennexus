use anyhow::{Context, Result};
use rusqlite::{params, Connection};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::core::context::model::{BackfillContextResult, ContextRunMode};

pub struct ContextObservabilityStore {
    connection: Connection,
}

impl ContextObservabilityStore {
    pub fn open_default() -> Result<Self> {
        let path = default_database_path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).with_context(|| {
                format!(
                    "Failed to create observability directory '{}'.",
                    parent.display()
                )
            })?;
        }
        Self::open(&path)
    }

    pub fn open(path: &Path) -> Result<Self> {
        let connection = Connection::open(path).with_context(|| {
            format!("Failed to open observability SQLite '{}'.", path.display())
        })?;

        let store = Self { connection };
        store.initialize_schema()?;
        Ok(store)
    }

    pub fn persist_backfill_context_result(&self, result: &BackfillContextResult) -> Result<()> {
        let started_at = unix_epoch_seconds();
        let finished_at = unix_epoch_seconds();
        let run_outcome = if result.failed_count() > 0 || result.missing_count() > 0 {
            "incomplete"
        } else {
            "complete"
        };

        self.connection
            .execute(
                "INSERT INTO cdd_runs (
                    run_mode,
                    context_id,
                    context_file,
                    started_at,
                    finished_at,
                    outcome,
                    implemented_count,
                    failed_count,
                    missing_count,
                    error_summary
                ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, NULL)",
                params![
                    ContextRunMode::Backfill.as_str(),
                    result.context_id,
                    result.context_file.display().to_string(),
                    started_at,
                    finished_at,
                    run_outcome,
                    result.implemented_count() as i64,
                    result.failed_count() as i64,
                    result.missing_count() as i64,
                ],
            )
            .with_context(|| {
                format!(
                    "Failed to persist run record for context '{}'.",
                    result.context_id
                )
            })?;

        let run_id = self.connection.last_insert_rowid();
        let mut statement = self
            .connection
            .prepare(
                "INSERT INTO cdd_tasks (
                    run_id,
                    test_id,
                    status,
                    details
                ) VALUES (?1, ?2, ?3, ?4)",
            )
            .context("Failed to prepare task insert statement.")?;

        for task in &result.tasks {
            statement
                .execute(params![
                    run_id,
                    task.test_id,
                    task.status.as_str(),
                    task.details
                ])
                .with_context(|| {
                    format!(
                        "Failed to persist task '{}' for context '{}'.",
                        task.test_id, result.context_id
                    )
                })?;
        }

        Ok(())
    }

    fn initialize_schema(&self) -> Result<()> {
        self.connection
            .execute_batch(
                "
                CREATE TABLE IF NOT EXISTS cdd_runs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_mode TEXT NOT NULL,
                    context_id TEXT NOT NULL,
                    context_file TEXT NOT NULL,
                    started_at INTEGER NOT NULL,
                    finished_at INTEGER NOT NULL,
                    outcome TEXT NOT NULL,
                    implemented_count INTEGER NOT NULL,
                    failed_count INTEGER NOT NULL,
                    missing_count INTEGER NOT NULL,
                    error_summary TEXT
                );

                CREATE TABLE IF NOT EXISTS cdd_tasks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    run_id INTEGER NOT NULL,
                    test_id TEXT NOT NULL,
                    status TEXT NOT NULL,
                    details TEXT,
                    FOREIGN KEY(run_id) REFERENCES cdd_runs(id) ON DELETE CASCADE
                );
                ",
            )
            .context("Failed to initialize CDD observability SQLite schema.")?;

        Ok(())
    }
}

pub fn default_database_path() -> PathBuf {
    Path::new(".nexus")
        .join("context")
        .join("observability.sqlite")
}

fn unix_epoch_seconds() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use tempfile::tempdir;

    use crate::core::context::model::{BackfillTaskResult, ContextTaskStatus};

    #[test]
    fn context_backfill_persists_results_with_backfill_run_mode() {
        let temp = tempdir().expect("tempdir");
        let db_path = temp.path().join("observability.sqlite");
        let store = ContextObservabilityStore::open(&db_path).expect("store should open");

        let result = BackfillContextResult {
            context_id: "CDD_017".to_string(),
            context_file: PathBuf::from(".nexus/context/nexus-cli/cdd/CDD_017.md"),
            tasks: vec![BackfillTaskResult {
                test_id: "context_backfill_task".to_string(),
                status: ContextTaskStatus::Implemented,
                details: None,
            }],
        };

        store
            .persist_backfill_context_result(&result)
            .expect("persist should pass");

        let verify = Connection::open(db_path).expect("verify connection");
        let run_mode: String = verify
            .query_row(
                "SELECT run_mode FROM cdd_runs ORDER BY id DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .expect("run should exist");
        assert_eq!(run_mode, "backfill");
    }
}
