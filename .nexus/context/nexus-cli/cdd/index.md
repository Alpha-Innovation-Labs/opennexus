# nexus-cli cdd

## Scope

Owns context-driven development orchestration commands that transform context specifications into discoverable tests, enforce pre-coding rule selection gates, drive iterative coding-agent loops, and report context test implementation status for a chosen context file.

## Context Files

| ID | Title |
|----|-------|
| CDD_001 | Context Implement Rule Selection Gate |
| CDD_002 | Context Test Status Command |
| CDD_003 | Context Test Generation and Discovery Gate |
| CDD_004 | Context Coder and Validator Iteration Loop |
| CDD_005 | Context Stage Logging and Fail-Fast Errors |
| CDD_006 | Context Loop Bounds and Termination Controls |
| CDD_007 | Context SQLite Run Registry and Schema |
| CDD_008 | Context Versioned Dirty State Detection |
| CDD_009 | Context Next Actions Task State Machine |
| CDD_010 | Context Dynamic Agent Session Associations |
| CDD_011 | Context Observability Event Timeline and Failure Reasons |
| CDD_012 | Context Resume and Work Deduplication Policy |
| CDD_013 | Context CLI Health and Drift Commands |
| CDD_014 | Context CLI Observability and Task Drilldown |
| CDD_015 | Context CLI Session Retrieval by Next Action |
| CDD_016 | Context Retention Export and Maintenance |
| CDD_017 | Context Backfill from Existing Code |
| CDD_018 | Context Backfill Global Audit |

## Interfaces

| Interface | Description |
|-----------|-------------|
| `opennexus context implement --context-file <path>` | Runs staged CDD orchestration (parse, generate tests, verify tests, implement, validate, repeat) |
| `opennexus context test-status --context-file <path>` | Reports test existence/discovery for tests derived from context `Next Actions` table |

## Dependencies

| Dependency | Purpose |
|------------|---------|
| `clap` | Parse context command arguments, options, and loop controls |
| `serde` / `serde_json` | Persist loop checkpoints, verification reports, and structured logs |
| CDD context skill | Enforce canonical context format, action/test extraction, and naming constraints |
| coding rule files under `.nexus/ai_harness/rules/` | Apply one selected coding rule as hard constraint during coding stages |

## Troubleshooting

- If orchestration stops before coding, verify a coding rule can be selected unambiguously from `.nexus/ai_harness/rules/`.
- If generated tests are not discovered, verify test file naming and test runner discovery patterns used by the repository.
- If loop reaches max iterations, inspect per-stage logs to identify whether failures happen in test generation, coding, or validation.
