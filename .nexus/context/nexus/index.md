---
project_id: nexus
title: Nexus Core - Shared Infrastructure
created: "2024-12-01"
status: active
---

# nexus

## Overview

Core project infrastructure and shared tooling used across all Nexus crates. Contains workspace-level configuration, build optimization, testing utilities, and development tooling.

## Context Files

| ID | Title | Status |
|----|-------|--------|
| NEX_001 | Crate Test Infrastructure Setup | Completed |
| NEX_002 | Cargo Husky Setup | Completed |
| NEX_003 | Build Optimization | Completed |
| NEX_004 | Test Utils Crate | Completed |

## Workspace Structure

```
nexus/
├── .context/           # CDD context files
├── .cdd/              # CDD rules and templates
├── crates/
│   ├── nexus-cli/      # Thin CLI client
│   ├── nexus-client/   # Shared client library
│   ├── nexus-server/   # Orchestrator daemon
│   ├── nexus-workflow/ # Workflow definitions
│   ├── nexus-llm/      # Multi-provider LLM runtime
│   ├── nexus-rag/      # RAG search engine
│   └── nexus-test-utils/ # Shared test utilities
├── justfiles/         # Just recipes organized by category
└── Cargo.toml         # Workspace manifest
```

## Key Justfile Commands

| Command | Description |
|---------|-------------|
| `just run` | Run nexus CLI with args |
| `just tui` | Launch TUI |
| `just build` | Build release binary |
| `just test` | Run all tests |
| `just test-e2e` | Run E2E tests only |
| `just check` | Check code compiles |
| `just clippy` | Run clippy lints |
| `just fmt` | Format code |

## Development Workflow

1. Context files define desired outcomes in `.context/`
2. E2E tests are generated from context file scenarios
3. Code is written to make tests pass
4. All changes go through pre-commit hooks (cargo husky)

## Related Context

- [Vision](../vision.md) - Project architecture and goals
- [E2E Test Standards](../../.cdd/rules/e2e_tests.md) - Testing guidelines
