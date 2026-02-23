---
project_id: nexus-cli
title: OpenNexus CLI
created: "2024-12-01"
status: active
dependencies:
  - clap
  - include_dir
  - reqwest
---

# nexus-cli

## Features

| Feature | Path | Purpose |
|---------|------|---------|
| `core` | `.nexus/context/nexus-cli/` | CLI-wide setup, command system, and shared behavior |
| `marketplace` | `.nexus/context/nexus-cli/marketplace/` | Marketplace search/install workflows and package sources |

## Context Files

| ID | Feature | Title | Status |
|----|---------|-------|--------|
| CLI_001 | core | Baseline CLI | Completed |
| CLI_003 | core | Clap Migration | Completed |
| CLI_005 | core | Project Commands | Active |
| CLI_006 | core | Context Commands | Active |
| CLI_007 | marketplace | Marketplace Search Command | Active |
| CLI_008 | marketplace | Marketplace Install Command | Active |

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
# Setup (default command when no subcommand is provided)
opennexus setup
opennexus

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

## Key Dependencies

| Crate | Purpose |
|-------|---------|
| clap | CLI parsing and command tree |
| include_dir | Embeds `.nexus` assets in the binary for setup extraction |
| reqwest | Fetches marketplace registry data |
| serde_json | JSON output payloads (`--format json`) |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| NEXUS_MARKETPLACE_REGISTRY_URL | Built-in GitHub raw URL | Overrides marketplace registry source (`file://...` or HTTP URL) |

## Harness Behavior

`opennexus setup` manages both source assets and generated links:

- Extracts embedded `.nexus` assets and updates `.nexus/.version`.
- Prunes stale generated files from `.opencode/command`, `.opencode/skills`, and `.opencode/rules`.
- Recreates `.opencode` links to `.nexus/ai_harness/commands`, `.nexus/ai_harness/skills`, and `.nexus/ai_harness/rules`.
- Removes legacy top-level `.nexus/rules` when present.

## Troubleshooting

- If marketplace search/install fails, verify network access or set `NEXUS_MARKETPLACE_REGISTRY_URL=file://<local-registry.json>`.
- If setup link creation fails on restricted filesystems, check directory permissions for `.opencode/` and `.nexus/`.
- If expected commands/skills/rules are missing after setup, rerun `opennexus setup` to re-extract embedded assets and regenerate links.
