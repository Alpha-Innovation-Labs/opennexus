use anyhow::{Context, Result};
use rusqlite::Connection;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use super::OrchestrationStore;

impl OrchestrationStore {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).with_context(|| {
                format!(
                    "Failed to create orchestration storage directory '{}'.",
                    parent.display()
                )
            })?;
        }
        let connection = Connection::open(path).with_context(|| {
            format!("Failed to open orchestration SQLite '{}'.", path.display())
        })?;
        connection
            .execute_batch("PRAGMA foreign_keys=ON;")
            .with_context(|| {
                format!(
                    "Failed to enable foreign key support for orchestration store '{}'.",
                    path.display()
                )
            })?;

        let store = Self { connection };
        store
            .initialize_schema()
            .context("Failed to initialize orchestration SQLite schema.")?;
        Ok(store)
    }

    pub(super) fn in_transaction<T, F>(&self, operation_label: &str, operation: F) -> Result<T>
    where
        F: FnOnce(&Connection) -> Result<T>,
    {
        self.connection
            .execute_batch("BEGIN IMMEDIATE TRANSACTION;")
            .with_context(|| {
                format!(
                    "Failed to start orchestration SQLite transaction for {}.",
                    operation_label
                )
            })?;
        match operation(&self.connection) {
            Ok(value) => {
                self.connection.execute_batch("COMMIT;").with_context(|| {
                    format!(
                        "Failed to commit orchestration SQLite transaction for {}.",
                        operation_label
                    )
                })?;
                Ok(value)
            }
            Err(err) => {
                let _ = self.connection.execute_batch("ROLLBACK;");
                Err(err).with_context(|| {
                    format!(
                        "Transactional orchestration write failed during {}.",
                        operation_label
                    )
                })
            }
        }
    }
}

pub fn default_orchestration_database_path() -> PathBuf {
    Path::new(".nexus")
        .join("orchestration")
        .join("state.sqlite")
}

pub(super) fn now_epoch() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
