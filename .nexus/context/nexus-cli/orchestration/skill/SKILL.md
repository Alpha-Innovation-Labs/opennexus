# Orchestration Skill

## Purpose

This skill explains how to operate the orchestration system in this repository so another agent can integrate with it safely and predictably.

The orchestration system executes context-driven workflows from pipeline definitions and persists run state for observability and recovery.

## High-Level Model

Orchestration has five core parts:

- Context specification: a context file under `.nexus/context/...` describing intent and Next Actions.
- Pipeline definition: an ordered set of named steps loaded from `.nexus/orchestration/pipelines.json` or `.nexus/orchestration/pipelines.yaml`.
- Step runner: executes steps in order, validates dependencies between steps, and stops on terminal outcomes.
- Agent stages: selected steps invoke the OpenCode agent for red-test authoring and implementation.
- State and observability: lifecycle data is persisted in SQLite at `.nexus/orchestration/state.sqlite`.

## What Orchestration Persists in SQLite

SQLite is the system of record for orchestration execution metadata. The database stores:

- Runs and run status (running, success, failed, stale).
- Step attempts and their status.
- Step input and output snapshots.
- Context snapshots and drift history.
- Next Action lifecycle reconciliation states.
- LLM traces (prompt/response metadata, status, latency, token metrics).
- Red-test classification records.
- Artifacts produced by steps.

This persistence is used for status queries, timeline views, trace inspection, deduplication decisions, and overwrite lineage.

### Schema At A Glance

The SQLite schema is orchestration-first and split by concern:

- `orchestration_runs`: one row per run, including pipeline, status, fingerprint, and terminal reason.
- `orchestration_step_attempts`: ordered step execution attempts with status and typed input/output snapshots.
- `orchestration_traces`: LLM trace payloads linked to run and step attempts.
- `orchestration_artifacts`: files or outputs emitted by steps, linked to run and step.
- `orchestration_context_snapshots`: context snapshots/hashes used for drift detection.
- `orchestration_next_action_snapshots` and `orchestration_next_action_lifecycle`: normalized action history and lifecycle reconciliation.
- `orchestration_red_test_classifications`: red gate classification records with reasons and remediation hints.

## Expected Execution Flow

A standard orchestration run behaves like this:

- Parse context file and validate required structure.
- Enforce dependency gate from context frontmatter references.
- Discover and select applicable coding rule.
- Resolve test runner strategy for the project.
- Generate test scaffolding mapped from Next Actions.
- Ask agent to author failing red tests.
- Verify tests are discoverable.
- Verify red-test failure quality (behavioral vs non-behavioral failures).
- Run iterative implementation loop with agent until success, timeout, or max iterations.

## Key Runtime Behaviors

- Deduplication: equivalent successful runs can be skipped by fingerprint.
- Overwrite: explicit overwrite forces a new run and tracks supersedence.
- Drift reconciliation: changed context snapshots can mark prior successful state stale and reconcile Next Action lifecycle.
- Checkpointing: optional checkpoint files allow resume from failure points.
- Dependency bypass: available only through explicit override when policy permits.
- Stop control: active runs can be terminated by operator action at context level.
- Restart policy: restart is a hard restart (stop active run if present, then start fresh with overwrite).

## Query Modes and Operational Use

Operationally, orchestration supports distinct query modes for:

- Current status for a context.
- Historical runs for a context.
- Timeline view of run and step progression.
- Trace retrieval for LLM interactions.
- Artifact retrieval for generated outputs.

For integration, treat these as read APIs over orchestration history, not as side-effecting execution.

## CLI Usage For External Integrations

Use the OpenNexus CLI as the public execution/query surface.

### Run A Pipeline

- Execute a pipeline by name:
  - `opennexus orchestration <pipeline_name> --context-file ".nexus/context/<project>/<feature>/<context>.md"`
- Useful run controls:
  - `--pipeline-file <path>` to select JSON or YAML pipeline definitions.
  - `--overwrite` to force a new run even if dedupe finds an equivalent success.
  - `--checkpoint-file <path>` to persist resume state.
  - `--resume-checkpoint <path>` to continue from previous failure.
  - `--allow-dependency-bypass` for explicit dependency gate override.

### Control Active Runs

- Stop active run for a context:
  - `opennexus orchestration stop --context-file "..."`
- Stop active run for a context + pipeline filter:
  - `opennexus orchestration stop --context-file "..." --pipeline-filter default`
- Restart with hard-restart semantics (no resume):
  - `opennexus orchestration restart <pipeline_name> --context-file "..."`
  - Behavior: stop active run if any -> launch fresh run with overwrite semantics.
- Check active run ids quickly:
  - `opennexus orchestration active --context-file "..."`

### Query Run State

- Latest status for a context:
  - `opennexus orchestration status --context-file "..."`
- Active runs for a context:
  - `opennexus orchestration active --context-file "..."`
- Run history for a context:
  - `opennexus orchestration runs --context-file "..."`
- Run timeline (step progression):
  - `opennexus orchestration timeline --context-file "..."`
- Trace view for one run:
  - `opennexus orchestration traces --context-file "..." --run-id <id>`
- Artifact view for one run:
  - `opennexus orchestration artifacts --context-file "..." --run-id <id>`

### Structured Output For Tooling

- Add `--format json` to control/query commands for machine-readable integration:
  - status, active, runs, timeline, traces, artifacts, stop, restart, start.
- Use `--run-id`, `--context-id`, `--context-file`, and `--pipeline-filter` to narrow queries.

Stable JSON contracts should include at least:

- `context_file`
- `pipeline_name` (when relevant)
- `run_id`
- `status` (`running|success|failed|stale|stopped`)
- `terminal_reason` (if terminal)
- `started_at` / `ended_at`
- `message`
- `remediation` (when actionable)

For command-specific payloads:

- `status` includes `active_run_ids`.
- `runs` includes a `runs` array ordered newest first.
- `stop`/`restart` include `action` and explicit action result fields.

### How To Call Different Steps

Steps are not invoked as standalone CLI subcommands. To run specific phases, define pipeline variants with different step lists and call by pipeline name.

- Example concept:
  - `red_only` pipeline: parse -> dependency_gate -> rule/test resolution -> scaffold -> red author -> red verification.
  - `full` pipeline: all steps including coder iteration.
- Then run:
  - `opennexus orchestration red_only --context-file "..."`
  - `opennexus orchestration full --context-file "..."`

## Integration Guidance for Other Agents

When integrating with orchestration, an agent should:

- Treat context files as source-of-truth for intended behavior.
- Select a pipeline by name and avoid assuming a fixed hardcoded step order.
- Expect typed step contracts and wiring validation to reject invalid compositions.
- Read SQLite-backed observability for run-aware decisions instead of parsing console logs.
- Handle failed runs as resumable workflows, not always full restarts.
- Use timeline, traces, and artifacts to produce summaries or downstream automation.

## Guardrails

- Do not bypass dependency gates unless explicitly requested.
- Do not treat restart as resume. Current restart policy is hard restart only.
- Do not treat syntax/import/collection failures as valid red phase outcomes.
- Do not assume all runner/toolchain projects behave like Rust; resolution is project-aware.
- Do not depend on undocumented table internals for external integrations; prefer stable command/query surfaces.

## Practical Outcome

If another agent follows this skill, it should be able to:

- Execute orchestration pipelines from context files.
- Monitor and explain run progress from SQLite-backed state.
- Resume and investigate failures with trace and timeline evidence.
- Integrate orchestration output into higher-level automation without reverse-engineering execution logs.
