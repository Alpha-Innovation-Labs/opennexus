---
project_id: cdd-web-ui
title: CDD Web UI
created: "2026-02-23"
status: active
dependencies:
  - nexus-cli-cdd
  - sqlite
---

# cdd-web-ui

## Overview

`cdd-web-ui` provides a lightweight web workspace for context-driven development operations backed by the CDD SQLite observability data model. It allows operators to execute one selected context line, inspect persisted task results, and follow active coding-session progress.

## Features

| Feature | Path | Purpose |
|---------|------|---------|
| `workspace` | `.nexus/context/cdd-web-ui/workspace/` | Interactive UI for line execution, result visibility, and live session monitoring |

## Architecture

```text
Context Files (.nexus/context/*)
            |
            v
   CDD Orchestration Backend (nexus-cli context)
            |
            v
      SQLite Observability Store
            |
            v
        cdd-web-ui Workspace
      (execute, status, live stream)
```

## CLI Usage

```bash
# Launch the CDD web workspace UI
just web

# Execute one context file workflow from backend
opennexus context implement --context-file <path>

# Reconcile existing implementation state
opennexus context backfill --context-file <path>

# Inspect test discoverability for one context
opennexus context test-status --context-file <path>
```

## Key Dependencies

| Dependency | Purpose |
|------------|---------|
| `nexus-cli/cdd` | Source of orchestration, backfill, and observability writes |
| `SQLite` | Durable run/task/session state queried by web UI |
| `Context files` | Source of Next Actions rows and test identifiers |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CDD_DB_PATH` | `.nexus/context/observability.sqlite` | SQLite database path read by UI services |
| `CDD_UI_PORT` | `4173` | Local web UI server port |

## Debugging & Troubleshooting

- If UI shows no contexts, verify context files exist under `.nexus/context/` and contain valid frontmatter plus `Next Actions`.
- If UI shows stale status, verify backend workflow wrote to the expected SQLite path.
- If live session view is empty while task is running, verify provider session associations are being persisted for task attempts.
- If `just web` fails to boot, verify `bun` is installed and that `apps/web` dependencies can be installed.
