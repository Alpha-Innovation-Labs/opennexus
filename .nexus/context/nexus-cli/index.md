---
project_id: nexus-cli
title: OpenNexus CLI
created: "2024-12-01"
status: active
dependencies:
  - nexus
---

# nexus-cli

## Features

| Feature | Path | Purpose |
|---------|------|---------|
| `core` | `.nexus/context/nexus-cli/core/` | CLI-wide setup, command system, and shared behavior |
| `marketplace` | `.nexus/context/nexus-cli/marketplace/` | Marketplace search/install workflows and package sources |
| `ralph` | `.nexus/context/nexus-cli/ralph/` | Rust `opennexus ralph` command parity with the current Ralph CLI API |
| `cdd` | `.nexus/context/nexus-cli/cdd/` | Context-driven test-first orchestration and context test status reporting |
| `orchestration` | `.nexus/context/nexus-cli/orchestration/` | Generic pipeline orchestration platform with SQLite-backed state and observability |

## Context Files

| ID | Feature | Title |
|----|---------|-------|
| CLI_001 | core | Setup Command |
| CLI_002 | core | Version Command |
| CLI_003 | core | Help Command |
| CLI_004 | core | Uninstall Command |
| CLI_005 | core | Update Command |
| MKT_001 | marketplace | Marketplace Search Command |
| MKT_002 | marketplace | Marketplace Install Command |
| RAL_001 | ralph | Ralph Command Surface Parity |
| RAL_002 | ralph | Ralph Loop State Lifecycle |
| RAL_003 | ralph | Ralph Agent Backend and Rotation Parity |
| RAL_004 | ralph | Ralph Context and Tasks Command Parity |
| RAL_005 | ralph | Ralph Promise and Iteration Control Parity |
| RAL_006 | ralph | Ralph Iteration Telemetry and Auto-Commit Parity |
| RAL_007 | ralph | Ralph Prompt Construction and Template Parity |
| RAL_008 | ralph | Ralph Diagnostics and Recovery Parity |
| CDD_001 | cdd | Context Implement Rule Selection Gate |
| CDD_002 | cdd | Context Test Status Command |
| CDD_003 | cdd | Context Test Generation and Discovery Gate |
| CDD_004 | cdd | Context Coder and Validator Iteration Loop |
| CDD_005 | cdd | Context Stage Logging and Fail-Fast Errors |
| CDD_006 | cdd | Context Loop Bounds and Termination Controls |
| CDD_007 | cdd | Context SQLite Run Registry and Schema |
| CDD_008 | cdd | Context Versioned Dirty State Detection |
| CDD_009 | cdd | Context Next Actions Task State Machine |
| CDD_010 | cdd | Context Dynamic Agent Session Associations |
| CDD_011 | cdd | Context Observability Event Timeline and Failure Reasons |
| CDD_012 | cdd | Context Resume and Work Deduplication Policy |
| CDD_013 | cdd | Context CLI Health and Drift Commands |
| CDD_014 | cdd | Context CLI Observability and Task Drilldown |
| CDD_015 | cdd | Context CLI Session Retrieval by Next Action |
| CDD_016 | cdd | Context Retention Export and Maintenance |
| CDD_017 | cdd | Context Backfill from Existing Code |
| CDD_018 | cdd | Context Backfill Global Audit |
| ORC_001 | orchestration | Orchestration Command Surface and Pipeline Definition Loader |
| ORC_002 | orchestration | Typed Step Contracts and Step Registry |
| ORC_003 | orchestration | Orchestration SQLite State Store and Schema |
| ORC_004 | orchestration | Context Dependency Graph and Blocking Gate |
| ORC_005 | orchestration | Run Deduplication and Overwrite Policy |
| ORC_006 | orchestration | Context Spec Drift Reconciliation |
| ORC_007 | orchestration | LLM Trace Capture and Observability API |
| ORC_008 | orchestration | Strict Red-Test Failure Classification Gate |
| ORC_009 | orchestration | UI Run Timeline and Artifact Query Views |

## Overview

OpenNexus is a local Rust CLI (`opennexus`) for setting up and maintaining Nexus project assets. It handles local harness extraction/sync, marketplace search/install, and global install lifecycle helpers (update/uninstall).

## Architecture

```
nexus-cli
└── Binary (src/main.rs)
    ├── cli.rs               → Clap definitions and subcommands
    ├── commands/
    │   ├── setup.rs         → Extract .nexus and sync .opencode links
    │   ├── marketplace.rs   → Search/install context, skill, and rule packages
    │   ├── update.rs        → Update published CLI install
    │   └── uninstall.rs     → Remove published CLI install
    └── output.rs            → Human-readable status output
```

## CLI Usage

```bash
# Help (default when no subcommand is provided)
opennexus
opennexus --help

# Setup command
opennexus setup
opennexus setup --harness opencode
opennexus setup --harness claude
opennexus setup --force

# Marketplace discovery/install
opennexus marketplace search "fumadocs"
opennexus marketplace install fumadocs
opennexus marketplace install github.com/<owner>/<repo>

# Output mode for scripting
opennexus --format json marketplace search "rust"

# Install lifecycle helpers
opennexus update
opennexus uninstall
```

## Project Dependencies

| Dependency | Purpose |
|------------|---------|
| `nexus` | Provides shared repository workflow conventions and infrastructure used by `nexus-cli` development and verification flows |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| NEXUS_MARKETPLACE_REGISTRY_URL | Built-in GitHub raw URL | Overrides marketplace registry source (`file://...` or HTTP URL) |

## Harness Behavior

`opennexus setup` manages both source assets and generated links:

- Extracts embedded `.nexus` assets, updates `.nexus/.version`, and writes harness config in `.nexus/config.json`.
- Ensures `.nexus/context/` exists as an empty directory and does not seed bundled context files.
- Prunes stale generated files from `.opencode/command`, `.opencode/tools`, `.opencode/skills`, and `.opencode/rules`.
- Recreates `.opencode` links to `.nexus/ai_harness/commands`, `.nexus/tools`, `.nexus/ai_harness/skills`, and `.nexus/ai_harness/rules`.
- Creates `.claude/commands` links when `--harness claude` is selected.
- Removes legacy top-level `.nexus/rules` when present.

## Troubleshooting

- If marketplace search/install fails, verify network access or set `NEXUS_MARKETPLACE_REGISTRY_URL=file://<local-registry.json>`.
- If setup link creation fails on restricted filesystems, check directory permissions for `.opencode/` and `.nexus/`.
- If `.nexus/context/` unexpectedly contains seeded defaults after setup, rerun `opennexus setup`; only user-created or marketplace-installed contexts should remain.
- If expected commands/skills/rules are missing after setup, rerun `opennexus setup` to re-extract embedded assets and regenerate links.
