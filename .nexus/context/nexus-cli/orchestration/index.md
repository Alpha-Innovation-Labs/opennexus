---
project_id: nexus-cli-orchestration
title: Nexus CLI Orchestration
created: "2026-02-27"
status: active
dependencies:
  - nexus-cli
  - nexus-cli-cdd
---

# nexus-cli orchestration

## Scope

Owns the generic pipeline orchestration platform for `opennexus orchestration <pipeline-name>`, including pipeline definition loading, typed step execution, dependency-aware run gating, SQLite-backed lifecycle state, and UI-facing observability surfaces.

## Context Files

| ID | Title |
|----|-------|
| ORC_001 | Orchestration Command Surface and Pipeline Definition Loader |
| ORC_002 | Typed Step Contracts and Step Registry |
| ORC_003 | Orchestration SQLite State Store and Schema |
| ORC_004 | Context Dependency Graph and Blocking Gate |
| ORC_005 | Run Deduplication and Overwrite Policy |
| ORC_006 | Context Spec Drift Reconciliation |
| ORC_007 | LLM Trace Capture and Observability API |
| ORC_008 | Strict Red-Test Failure Classification Gate |
| ORC_009 | UI Run Timeline and Artifact Query Views |

## Interfaces

| Interface | Description |
|-----------|-------------|
| `opennexus orchestration <pipeline-name> --context-file <path>` | Runs one configured pipeline against one context file |
| `opennexus orchestration status --context-file <path>` | Shows current context lifecycle state, dependency gates, and last terminal run |
| `opennexus orchestration runs --context-file <path>` | Lists historical runs and their terminal reasons |
| `opennexus orchestration traces --run-id <id>` | Returns structured per-step traces and artifact references |

Runtime notes:
- Pipeline execution should remain definition-driven (JSON/YAML) with step order controlled by pipeline files, not hardcoded runner branching.
- Pipeline step definitions should reference reusable execution units by `block_id`, with block implementations loaded from modular files via a block registry.
- Pipeline execution should accept both pipeline file and config file inputs so runtime values are supplied outside of hardcoded runner logic.
- OpenCode-backed jobs should initialize the SDK once per runtime and resolve server port from environment (`RBX_OPENCODE_PORT`, then fallback defaults).
- Worktree-backed coding runs should resolve working directory base from `RBX_WORKTREE_BASE_DIR` (or `RBX_WORKTREE_ROOT`) and default to `~/.worktrees/<project_name>/...` when unset.
- Restate-backed execution can expose the same lifecycle semantics as local orchestration while preserving step-level observability.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RBX_OPENCODE_PORT` | `4196` | OpenCode SDK server port for orchestration jobs |
| `RBX_WORKTREE_BASE_DIR` | `~/.worktrees` | Base directory where `<project_name>` worktree folders are created |
| `RBX_WORKTREE_ROOT` | (none) | Optional compatibility alias for worktree base directory |

## Dependencies

| Dependency | Purpose |
|------------|---------|
| `nexus-cli` | Provides command runtime and shared CLI behavior required by orchestration workflows |
| `nexus-cli-cdd` | Provides CDD lifecycle conventions used by orchestration dependency and status semantics |

## Troubleshooting

- If a pipeline is rejected as already completed, inspect run fingerprint inputs and rerun with explicit overwrite when intended.
- If a context is blocked, verify referenced `depends_on` project or context records are complete and unambiguous.
- If UI views are empty, verify traces and step outputs were persisted for the selected run id.
- If OpenCode job steps fail to initialize in orchestration, verify the configured SDK port is not colliding and `RBX_OPENCODE_PORT` is set to the intended value.
- If coding steps unexpectedly modify tests, verify orchestration write-policy enforcement is enabled for source-only coding jobs and rejects test-path mutations.
- If worktree assignment fails, verify `RBX_WORKTREE_BASE_DIR` resolves to a writable location and repository `git worktree` operations are permitted.
- If Restate startup fails with node-name mismatch for existing data, set `RESTATE_NODE_NAME` to the existing node identity before running orchestration commands.
