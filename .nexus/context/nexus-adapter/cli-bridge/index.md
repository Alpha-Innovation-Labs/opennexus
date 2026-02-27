---
project_id: nexus-adapter-cli-bridge
title: Nexus Adapter CLI Bridge
created: "2026-02-27"
status: active
dependencies:
  - nexus-adapter
  - nexus-cli
---

# nexus-adapter cli-bridge

## Scope

Owns the typed bridge between web features and `opennexus orchestration` commands, including run start/stop/restart controls, active-run discovery, run history retrieval, and normalization of structured command output for UI consumers.

## Context Files

| ID | Title |
|----|-------|
| NAD_001 | Adapter CLI Command Execution Surface |
| NAD_002 | Adapter Active Run Control Stop and Restart |
| NAD_003 | Adapter Status and Run History Query Mapping |
| NAD_004 | Adapter Hard Restart Policy Enforcement |
| NAD_005 | Adapter Error Normalization and Remediation Messaging |
| NAD_006 | Adapter State Refresh and Consistency Rules |

## Interfaces

| Interface | Description |
|-----------|-------------|
| `start(context, pipeline)` | Launches `opennexus orchestration <pipeline> --context-file <path>` |
| `stop(context, pipeline_filter?)` | Stops active run via orchestration stop command |
| `restart(context, pipeline)` | Executes hard restart semantics through orchestration restart command |
| `query(context)` | Fetches active/status/runs/timeline data as typed payloads |

## Dependencies

| Dependency | Purpose |
|------------|---------|
| `nexus-adapter` | Provides adapter-level contracts and lifecycle rules for bridge behavior |
| `nexus-cli` | Provides orchestration command surface consumed by bridge execution and query paths |

## Blocking Dependencies

- Requires orchestration command support for `active`, `stop`, and `restart` before integration can be considered complete.
- Requires stable `--format json` output fields from orchestration commands used by the bridge.

## Troubleshooting

- If adapter parsing fails, inspect command JSON payload shape drift and update contract mapping.
- If stop/restart actions race, verify context path and pipeline filter scoping for active run selection.
- If history is incomplete, verify adapter queries both `runs` and `status` for the same context target.
