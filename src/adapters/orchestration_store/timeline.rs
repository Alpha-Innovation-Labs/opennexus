use anyhow::{bail, Context, Result};
use rusqlite::params;

use super::{OrchestrationStore, TimelineFilter, TimelineRow};

impl OrchestrationStore {
    pub fn query_timeline(&self, filter: &TimelineFilter) -> Result<Vec<TimelineRow>> {
        self.validate_timeline_filter(filter)?;

        let (query, args) = build_timeline_query(filter);
        let mut stmt = self
            .connection
            .prepare(&query)
            .context("Failed preparing timeline query.")?;

        let mut rows = stmt
            .query(rusqlite::params_from_iter(args.iter()))
            .context("Failed executing timeline query.")?;

        let mut result = Vec::<TimelineRow>::new();
        while let Some(row) = rows.next()? {
            let step_attempt_id: i64 = row.get(5)?;
            let trace_ids = self.list_trace_ids_for_step_attempt(step_attempt_id)?;
            let artifact_refs =
                self.list_artifact_refs_for_step(row.get(0)?, &row.get::<_, String>(6)?)?;
            result.push(TimelineRow {
                run_id: row.get(0)?,
                context_id: row.get(1)?,
                context_file: row.get(2)?,
                pipeline_name: row.get(3)?,
                run_status: row.get(4)?,
                step_attempt_id,
                step_id: row.get(6)?,
                attempt_index: row.get(7)?,
                step_status: row.get(8)?,
                terminal_reason: row.get(9)?,
                started_at: row.get(10)?,
                finished_at: row.get(11)?,
                trace_ids,
                artifact_refs,
            });
        }
        Ok(result)
    }

    fn validate_timeline_filter(&self, filter: &TimelineFilter) -> Result<()> {
        if let Some(run_id) = filter.run_id {
            if (filter.context_id.is_some()
                || filter.context_file.is_some()
                || filter.pipeline_name.is_some())
                && !self.run_matches_filters(run_id, filter)?
            {
                bail!(
                    "Unsupported filter combination: run_id {} does not match the supplied context/pipeline filters. Use `orchestration timeline --run-id {}` alone or pass matching filter values.",
                    run_id,
                    run_id
                );
            }
        }

        if let (Some(context_id), Some(context_file)) = (&filter.context_id, &filter.context_file) {
            let mut stmt = self
                .connection
                .prepare(
                    "SELECT 1 FROM orchestration_runs WHERE context_id=?1 AND context_file=?2 LIMIT 1",
                )
                .context("Failed preparing context_id/context_file compatibility query.")?;
            let mut rows = stmt
                .query(params![context_id, context_file])
                .with_context(|| {
                    format!(
                    "Failed validating context_id/context_file filter compatibility ('{}', '{}').",
                    context_id, context_file
                )
                })?;
            if rows.next()?.is_none() {
                bail!(
                    "Unsupported filter combination: context_id '{}' has no runs for context file '{}'. Use matching values or query with a single filter.",
                    context_id,
                    context_file
                );
            }
        }

        Ok(())
    }

    fn run_matches_filters(&self, run_id: i64, filter: &TimelineFilter) -> Result<bool> {
        let mut stmt = self
            .connection
            .prepare(
                "SELECT context_id, context_file, pipeline_name
                 FROM orchestration_runs WHERE id=?1 LIMIT 1",
            )
            .context("Failed preparing run/filter compatibility query.")?;
        let mut rows = stmt.query(params![run_id]).with_context(|| {
            format!(
                "Failed checking run/filter compatibility for run {}.",
                run_id
            )
        })?;
        let Some(row) = rows.next()? else {
            return Ok(false);
        };
        let context_id: String = row.get(0)?;
        let context_file: String = row.get(1)?;
        let pipeline_name: String = row.get(2)?;
        if let Some(expected) = &filter.context_id {
            if &context_id != expected {
                return Ok(false);
            }
        }
        if let Some(expected) = &filter.context_file {
            if &context_file != expected {
                return Ok(false);
            }
        }
        if let Some(expected) = &filter.pipeline_name {
            if &pipeline_name != expected {
                return Ok(false);
            }
        }
        Ok(true)
    }
}

fn build_timeline_query(filter: &TimelineFilter) -> (String, Vec<rusqlite::types::Value>) {
    let mut query = String::from(
        "SELECT
            r.id,
            r.context_id,
            r.context_file,
            r.pipeline_name,
            r.status,
            sa.id,
            sa.step_id,
            sa.attempt_index,
            sa.status,
            sa.terminal_reason,
            sa.started_at,
            sa.finished_at
        FROM orchestration_runs r
        JOIN orchestration_step_attempts sa ON sa.run_id = r.id",
    );
    let mut where_clauses = Vec::<String>::new();
    let mut args = Vec::<rusqlite::types::Value>::new();

    if let Some(run_id) = filter.run_id {
        where_clauses.push("r.id = ?".to_string());
        args.push(rusqlite::types::Value::Integer(run_id));
    }
    if let Some(context_id) = &filter.context_id {
        where_clauses.push("r.context_id = ?".to_string());
        args.push(rusqlite::types::Value::Text(context_id.clone()));
    }
    if let Some(context_file) = &filter.context_file {
        where_clauses.push("r.context_file = ?".to_string());
        args.push(rusqlite::types::Value::Text(context_file.clone()));
    }
    if let Some(pipeline_name) = &filter.pipeline_name {
        where_clauses.push("r.pipeline_name = ?".to_string());
        args.push(rusqlite::types::Value::Text(pipeline_name.clone()));
    }

    if !where_clauses.is_empty() {
        query.push_str(" WHERE ");
        query.push_str(&where_clauses.join(" AND "));
    }
    query.push_str(" ORDER BY r.id DESC, sa.id ASC");
    (query, args)
}
