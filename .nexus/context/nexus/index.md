---
project_id: nexus
title: Nexus Core - Shared Infrastructure
created: "2024-12-01"
status: active
---

# nexus

## Overview

Core workspace infrastructure for the OpenNexus repository. This project captures shared build/test workflows, hook policy, and test infrastructure that support the CLI and ai_harness lifecycle.

## Features

| Feature | Path | Purpose |
|---------|------|---------|
| `testing` | `.nexus/context/nexus/` | Shared test scaffolding and test utility behavior |
| `workflow` | `.nexus/context/nexus/` | Git hook and quality gate workflow expectations |
| `build` | `.nexus/context/nexus/` | Build speed and local developer feedback-loop optimization |

## Context Files

| ID | Feature | Title | Status |
|----|---------|-------|--------|
| NEX_001 | testing | Crate Test Infrastructure Setup | Active |
| NEX_002 | workflow | Cargo-Husky Git Hooks Setup | Active |
| NEX_003 | build | Build Optimization with sccache | Active |
| NEX_004 | testing | Shared Test Utilities Crate | Active |

## Architecture

```
nexus/
├── src/                          # opennexus CLI and command handlers
├── tests/                        # Workspace-level E2E and hook verification
├── .nexus/
│   ├── context/                  # CDD project + feature docs
│   ├── ai_harness/
│   │   ├── commands/             # Prompt command playbooks
│   │   ├── skills/               # Skill definitions
│   │   └── rules/                # RULE.md policy packs
│   └── marketplace/              # Installable marketplace packages
├── .cargo-husky/hooks/           # pre-commit and pre-push automation
└── justfiles/                    # Development recipes
```

## CLI Usage

```bash
# Setup workspace assets in a target project
opennexus setup

# Marketplace discovery and installation
opennexus marketplace search "query"
opennexus marketplace install fumadocs
```

## Key Dependencies

| Dependency | Purpose |
|------------|---------|
| `cargo-husky` | Git hook orchestration for pre-commit/pre-push checks |
| `just` | Standard local workflow command runner |
| `sccache` | Rust compilation cache for faster rebuilds |
| `nexus-test-utils` | Shared test isolation helpers used by E2E tests |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXUS_MARKETPLACE_REGISTRY_URL` | Built-in GitHub raw URL | Overrides marketplace registry source for search/install |
| `NEXUS_CONTEXT_DIR` | `.nexus/context` | Context directory root used by test and tooling flows |

## Debugging & Troubleshooting

- If hooks fail unexpectedly, run `.cargo-husky/hooks/pre-commit` or `.cargo-husky/hooks/pre-push` directly to isolate the failing command.
- If docs checks fail, run `just docs-sync` and stage generated docs updates.
- If setup linkage is inconsistent, rerun `opennexus setup --harness opencode` to rebuild generated links.
