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

## Dependencies

| Dependency | Purpose |
|------------|---------|
| `nexus-cli/cdd` | Source of context parsing conventions and prior context lifecycle semantics |
| `SQLite` | Durable run, step, artifact, and observability state for CLI and UI consumers |
| `serde` / `serde_json` / `serde_yaml` | Pipeline definition parsing and typed payload serialization |
| `context-driven-development` skill | Canonical context structure, dependency semantics, and test identifier rules |

## Blocking Dependencies

- If orchestration semantics reuse prior CDD run-state behavior, align with `CDD_007`, `CDD_008`, `CDD_011`, and `CDD_012` before finalizing contracts.
- If dependency gate behavior is ambiguous, resolve `depends_on` references before execution.

## Troubleshooting

- If a pipeline is rejected as already completed, inspect run fingerprint inputs and rerun with explicit overwrite when intended.
- If a context is blocked, verify referenced `depends_on` project or context records are complete and unambiguous.
- If UI views are empty, verify traces and step outputs were persisted for the selected run id.
