---
context_id: CDD_007
title: Context SQLite Run Registry and Schema
project: nexus-cli
feature: cdd
created: "2026-02-23"

depends_on:
  contexts:
    - id: CDD_006
      why: This dependency outcome is required before this context can proceed.
---

# CDD_007: Context SQLite Run Registry and Schema

## Desired Outcome

`opennexus context` persists run, stage, task, and session observability in a SQLite database with a versioned schema and migration safety so each execution is durable, queryable, and consistent across restarts.

## Next Actions

| Description | Test |
|-------------|------|
| Create a SQLite database for CDD workflow state and observability records | `context_sqlite_database_created_for_cdd_workflow` |
| Create versioned schema migrations for runs, iterations, stages, tasks, and sessions tables | `context_sqlite_schema_migrations_applied_with_version_tracking` |
| Persist run metadata including context path, context hash, selected rule, and execution bounds | `context_sqlite_persists_run_metadata_and_constraints` |
| Persist stage and task lifecycle records transactionally during workflow execution | `context_sqlite_persists_stage_and_task_lifecycle_records` |
| Return actionable errors when database initialization or migration execution fails | `context_sqlite_reports_actionable_init_and_migration_errors` |
