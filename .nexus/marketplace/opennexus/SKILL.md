# opennexus

> `opennexus` is a Rust CLI plus web workspace for Context-Driven Development operations. It coordinates setup, marketplace actions, context execution loops, and observability with a thin orchestration model.

Use this skill when contributing to runtime behavior, command surfaces, or workspace APIs. Follow existing handlers and contracts instead of introducing parallel flows, and treat parser and execution constraints as compatibility boundaries.

## Agent Operating Rules

- Keep generation and implementation scope synced to classified root folders in `.nexus/config.json` (`include_folders` and `exclude_folders`), and never generate domain content from `docs/`.
- Route behavior changes through existing command handlers and API/service layers; avoid duplicate orchestration paths.
- Treat context parsing contracts as hard requirements: frontmatter `context_id`, `## Next Actions` table, snake_case test ids.
- Require discoverable tests before `context implement`; require explicit rule selection when multiple rule files are available.
- Preserve optimistic concurrency behavior in file edits (`expectedMtimeMs` and `STALE_FILE`).
- Treat live execution stream state as transient and non-durable.

## Environment and Version Constraints

- Rust crate: `opennexus` version `0.1.7`, edition `2021`.
- CLI setup uses `dialoguer` (fuzzy picker dependency).
- Web app stack in `apps/web`: `next` `16.1.6`, `react` `^19.2.4`, `react-dom` `^19.2.4`.
- Quality gates are enforced by cargo-husky hooks (docs sync checks, formatting, clippy, push-time tests).

## Quick Task Playbooks

- Setup lifecycle: run setup via CLI handler flow, then verify generated Nexus/OpenCode linkage and config state.
- Marketplace flow: use `marketplace search/install` handlers; keep all source-of-truth changes in runtime modules.
- Context execution flow: validate context format, run implement, inspect test status, then backfill observability.
- Web execution flow: load file, save with mtime guard, start row execution, poll status/live stream.
- Release hygiene: keep crate and wrapper version/tag alignment before publish automation.

## Getting Started

- Start with local commands through `just` recipes or `cargo run --bin opennexus -- ...`.
- For CLI behavior, begin in command routing and feature modules before changing adapters/services.
- For web behavior, follow route -> service -> store/parser flow; keep path constraints and error contracts intact.
- Run checks before pushing so hook-gated workflows pass on first attempt.

## Workspace Overview

- Rust workspace provides the primary CLI/runtime orchestration.
- Next.js app in `apps/web` provides interactive context file workflows and execution observability.
- `.nexus` is source-of-truth operational content; `.opencode` is generated linkage managed by setup.
- Observability combines persisted SQLite records and transient in-memory runtime stream state.

## Rust CLI Runtime

- Primary command surface is defined by `Cli`, `Commands`, `MarketplaceCommands`, `ContextCommands`, and `RalphCommand`.
- Runtime entry handlers include `run_setup`, `run_update`, `run_uninstall`, `run_marketplace_search`, `run_marketplace_install`, `run_context_implement`, `run_context_test_status`, `run_context_backfill`, and `run_ralph`.
- Context implementation depends on strict markdown parsing plus test discovery; invalid context structure blocks execution.
- Backfill writes task/run state to SQLite tables `cdd_runs` and `cdd_tasks`.

## Web Workspace UI

- App Router endpoints drive file browsing/editing and execution telemetry under `/api/workspace/*`.
- File writes use optimistic concurrency (`expectedMtimeMs`) and reject stale writes.
- Workspace file access is constrained to allowed `.nexus` markdown scopes for safety.
- Live stream status is served from in-memory runtime state and is reset on server restart.

## Harness and Tooling Operations

- Setup manages `.nexus` assets and generated `.opencode` links; avoid manual link drift.
- `justfiles` provide the expected operational interface for setup, run, verification, and publishing tasks.
- Hook policy enforces pre-commit/pre-push checks; contributors should run equivalent checks locally first.
- Release workflows require coordinated version alignment across crate and wrappers.

## Usage Cards

### CLI Setup and Lifecycle

- Use when: bootstrapping or maintaining Nexus/OpenCode project wiring.
- Enable/Install: install CLI binary and ensure repo has `.nexus` assets.
- Import/Invoke: invoke `Commands::Setup` or top-level default setup path.
- Minimal flow:
  1. Run `opennexus setup` (or invoke setup by default command path).
  2. Confirm `.nexus/config.json` is written with harness/version state.
  3. Verify generated `.opencode` links reflect current `.nexus` source content.
- Key APIs: `run_setup`, `resolve_setup_harness`.
- Pitfalls: harness picker currently exposes only `opencode` even though setup code contains a `claude` branch.
- Source: `src/commands/setup.rs`.

### Context Implement and Test Status

- Use when: executing one context spec into verifiable code changes.
- Enable/Install: valid context markdown with required frontmatter and `## Next Actions` table.
- Import/Invoke: `ContextCommands::Implement` and `ContextCommands::TestStatus`.
- Minimal flow:
  1. Run test status on context file to confirm discovered/missing tests.
  2. Execute implement with explicit `--rule-file` when multiple rules exist.
  3. Inspect completion output and then backfill status when needed.
- Key APIs: `run_context_test_status`, `run_context_implement`, `run_context_backfill`.
- Pitfalls: non-snake_case test ids or malformed tables fail parsing; undiscoverable tests block implement.
- Source: `src/features/context/implement.rs`.

### Web Workspace File and Execution APIs

- Use when: editing context files and triggering row-level execution from UI.
- Enable/Install: run web app with `apps/web` dependencies installed.
- Import/Invoke: call workspace API routes from client layer.
- Minimal flow:
  1. GET `/api/workspace/files` and GET `/api/workspace/file`.
  2. PUT `/api/workspace/file` with `expectedMtimeMs`.
  3. POST `/api/workspace/execute`.
  4. GET `/api/workspace/status` and GET `/api/workspace/live-stream`.
- Key APIs: `/api/workspace/files`, `/api/workspace/file`, `/api/workspace/next-actions`, `/api/workspace/execute`, `/api/workspace/status`, `/api/workspace/live-stream`, `/api/workspace/contexts`.
- Pitfalls: stale writes return `STALE_FILE`; live stream continuity is not durable across restarts.
- Source: `apps/web/src/app/api/workspace`.

### Ralph Runtime

- Use when: running iterative Ralph task orchestration from CLI.
- Enable/Install: ensure Ralph runtime dependencies and agent command paths are available.
- Import/Invoke: `Commands::Ralph` passthrough and `run_ralph` runtime entry.
- Minimal flow:
  1. Invoke `opennexus ralph ...` with required arguments.
  2. Monitor task progression and generated runtime artifacts.
  3. Review git effects when auto-commit behavior is enabled.
- Key APIs: `run_ralph`, `RalphOperation`.
- Pitfalls: auto-commit behavior can mutate branch history unexpectedly.
- Source: `src/features/ralph/runtime.rs`.

## API Reference

- CLI models: `Cli`, `OutputFormat`, `Commands`, `MarketplaceCommands`, `ContextCommands`, `RalphCommand`.
- CLI handlers: `run_setup`, `resolve_setup_harness`, `run_update`, `run_uninstall`, `run_marketplace_search`, `run_marketplace_install`, `run_context_implement`, `run_context_test_status`, `run_context_backfill`, `run_ralph`.
- Web client/server identifiers: `listWorkspaceFiles`, `loadWorkspaceFile`, `saveWorkspaceFile`, `fetchNextActions`, `startRowExecution`, `fetchTaskStatus`, `fetchLiveStream`.
- Web routes: `/api/workspace/files`, `/api/workspace/file`, `/api/workspace/next-actions`, `/api/workspace/execute`, `/api/workspace/status`, `/api/workspace/live-stream`, `/api/workspace/contexts`.

## Common Pitfalls

- Treating context markdown parsing as flexible; it is intentionally strict.
- Running implement without test discovery readiness.
- Ignoring stale-write protection in workspace file updates.
- Assuming live stream state is historical record.
- Bypassing just/hook checks and failing gated push workflows.

## Optional

- Prefer incremental updates to this skill when commit diff impact is narrow.
- Keep setup/harness behavior changes mirrored in tests and command help text.
- When adding new runtime surfaces, add a usage card before broad rollout.
