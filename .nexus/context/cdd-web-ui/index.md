---
project_id: cdd-web-ui
title: CDD Web UI
created: "2026-02-23"
status: active
dependencies:
  - nexus-cli
  - nexus-adapter
---

# cdd-web-ui

## Overview

`cdd-web-ui` provides a lightweight web workspace for context-driven development operations backed by the CDD SQLite observability data model. It allows operators to execute one selected context line, inspect persisted task results, and follow active coding-session progress.

## Features

| Feature | Path | Purpose |
|---------|------|---------|
| `workspace` | `.nexus/context/cdd-web-ui/workspace/` | Interactive UI for line execution, result visibility, and live session monitoring |
| `graph` | `.nexus/context/cdd-web-ui/graph/` | React Flow graph visualization of projects, contexts, and blocking dependencies |

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

# Launch the CDD context graph UI
just flow

# Run graph e2e checks (collision and overview fit)
bun --cwd apps/react-flow run test:e2e

# Execute one context file workflow from backend
opennexus context implement --context-file <path>

# Reconcile existing implementation state
opennexus context backfill --context-file <path>

# Inspect test discoverability for one context
opennexus context test-status --context-file <path>
```

## Project Dependencies

| Dependency | Purpose |
|------------|---------|
| `nexus-cli` | Provides context orchestration commands and observability data consumed by the UI |
| `nexus-adapter` | Provides typed command/query bridge behavior used by web-facing orchestration controls |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CDD_DB_PATH` | `.nexus/context/observability.sqlite` | SQLite database path read by UI services |
| `CDD_UI_PORT` | `4173` | Local web UI server port |
| `FLOW_UI_PORT` | `4174` | Local context graph UI server port |
| `NEXUS_REPO_ROOT` | auto-detected | Overrides repository root used by graph context discovery |
| `OPENCODE_BASE_URL` | `http://127.0.0.1:4096` | Overrides OpenCode server base URL used by graph conversation panel APIs |

## Debugging & Troubleshooting

- If UI shows no contexts, verify context files exist under `.nexus/context/` and contain valid frontmatter plus `Next Actions`.
- If UI shows stale status, verify backend workflow wrote to the expected SQLite path.
- If live session view is empty while task is running, verify provider session associations are being persisted for task attempts.
- If `just web` fails to boot, verify `bun` is installed and that `apps/web` dependencies can be installed.
- If `just flow` reports port conflicts, set a different port (for example `FLOW_UI_PORT=4274 just flow`).
- If graph appears blank, verify context files exist under `.nexus/context/cdd-web-ui/` and that only context files (not `index.md`) are expected as nodes.
- If graph interactions do not match expected mode, verify Select/Move/Resize indicator state in the bottom-right mode controls.
- If project dependency order appears incorrect, verify graph ordering is derived from context frontmatter `depends_on.contexts` prerequisite semantics rather than project `index.md` prose.
- If subproject row labels look like feature keys instead of human-readable names, verify feature `index.md` titles exist and are discoverable by graph context loading.
- If project-view subflow cards clip or overlap after reload, verify graph rehydrate self-heal is active and clear stale local storage state.
- If project view order feels random, verify project overview mode uses Dagre top-to-bottom ordering from cross-project dependency links.
- If project dependency edges are not visible, verify there are cross-project `depends_on.contexts` links in loaded context files.
- If dragged project subflows overlap, verify move mode is active and collision blocking is reverting only the moved project card.
- If graph conversation selector shows no sessions, verify OpenCode server is reachable at `OPENCODE_BASE_URL` and repository-scoped session listing is returning `200`.
