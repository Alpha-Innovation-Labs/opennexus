use anyhow::{Context, Result};
use rusqlite::params;

use super::connection::now_epoch;
use super::{OrchestrationStore, RedTestClassificationRecord};

impl OrchestrationStore {
    pub fn persist_red_test_classifications(
        &self,
        run_id: i64,
        records: &[RedTestClassificationRecord],
    ) -> Result<()> {
        self.in_transaction("red test classification persistence", |conn| {
            for record in records {
                conn.execute(
                    "INSERT INTO orchestration_red_test_classifications (
                        run_id, test_id, category, reason, remediation_hint, is_behavioral, created_at
                     ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                    params![
                        run_id,
                        record.test_id,
                        record.category,
                        record.reason,
                        record.remediation_hint,
                        record.is_behavioral as i64,
                        now_epoch(),
                    ],
                )
                .with_context(|| {
                    format!(
                        "Failed to persist red-test classification for test '{}' (run_id={}).",
                        record.test_id, run_id
                    )
                })?;
            }
            Ok(())
        })
    }
}
