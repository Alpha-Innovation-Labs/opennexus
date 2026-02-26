---
context_id: ORC_003
title: Orchestration SQLite State Store and Schema
project: nexus-cli
feature: orchestration
created: "2026-02-26"
depends_on:
  contexts:
    - ORC_001
    - ORC_002
---

# ORC_003: Orchestration SQLite State Store and Schema

## Desired Outcome

Orchestration execution persists run, step, artifact, and trace lifecycle data in a versioned SQLite schema so run state is durable, queryable, and migration-safe across repeated executions and CLI restarts.

## Next Actions

| Description | Test |
|-------------|------|
| Initialize orchestration SQLite database when store is missing | `orchestration_sqlite_initializes_database_when_missing` |
| Apply schema migrations with explicit schema version tracking | `orchestration_sqlite_applies_migrations_with_version_tracking` |
| Persist run and step lifecycle records transactionally during execution | `orchestration_sqlite_persists_run_and_step_lifecycle_records_transactionally` |
| Persist typed step input and output payload snapshots for each step attempt | `orchestration_sqlite_persists_typed_step_input_and_output_snapshots` |
| Return actionable errors when initialization, migration, or transactional writes fail | `orchestration_sqlite_reports_actionable_initialization_migration_or_write_failures` |
