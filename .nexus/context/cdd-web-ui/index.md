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

The graph experience includes an OpenCode side panel plus keyboard-driven chat modals (`Ctrl/Cmd+N` for a new single chat, `Ctrl/Cmd+A` for dual-lane parallel chat, `Ctrl/Cmd+S` for branch forking), a composer-level Fork fallback button, and a header-level `Forks` lineage graph viewer with diff-style fork-origin snippets.

The workspace keeps a persistent right-side chat shell while center views (Context/Forks/Chats/Workflows) change, and chat width restore-on-expand uses saved local state.

The flow UI also includes a `Workflows` view for invocation observability, with left-sidebar invocation selection and main-panel workflow status plus step-result details.

Theme controls now live in the top-right navbar as a single icon toggle (sun/moon), and selected mode persists across refresh while graph canvas backgrounds follow the active theme.

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

# Run tool-call rendering e2e for graph chat
bun --cwd apps/react-flow run test:e2e -- e2e/opencode-toolcalls.e2e.ts

# Run real OpenCode streaming e2e (no mocks)
OPENCODE_E2E_REAL=1 bun --cwd apps/react-flow run test:e2e -- e2e/opencode-streaming-real.e2e.ts

# Run forks tab lineage graph e2e
bun --cwd apps/react-flow run test:e2e -- e2e/opencode-forks-tab.e2e.ts

# Start local OpenCode server required by forks APIs
opencode serve --port 4096

# Run canvas theme persistence + light-mode color e2e
bun --cwd apps/react-flow run test:e2e -- e2e/canvas-theme-light-mode.e2e.ts

# Initialize shadcn in this app (run once)
bunx --bun shadcn@latest init --defaults --base-color neutral

# Install/refresh shadcn UI primitives through CLI
bunx --bun shadcn@latest add button dialog badge card resizable skeleton

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
- If assistant replies show only after reload, verify live SSE reply streaming is active on `/api/opencode/conversations/:id/messages` and the panel receives `delta` events before `done`.
- If tool calls do not appear in assistant messages, verify SSE `tool` events are emitted and conversation history includes tool parts for the same reply.
- If the `Ctrl/Cmd+N` or `Ctrl/Cmd+A` graph chat shortcuts do not open dialogs, verify keyboard focus remains in the app and no browser extension is intercepting those keys.
- If `Ctrl/Cmd+S` does not fork the conversation, use the composer Fork button and confirm an active conversation is selected.
- If parallel chat lanes show `(No text response)` unexpectedly, verify fallback history recovery can read latest assistant messages from `/api/opencode/conversations/:id/messages`.
- If forked chats exist in modal lanes but the `Forks` graph view is empty, verify sessions were created through native OpenCode fork APIs so parent linkage metadata is persisted.
- If operators cannot tell where a branch split happened, verify fork-origin message highlighting is visible in the branched lane timeline.
- If forks view shows `Unable to list forked OpenCode conversations: fetch failed`, verify `opencode serve --port 4096` is running (or `OPENCODE_BASE_URL` points to a reachable OpenCode server).
- If fork-origin bullets appear but edge mapping looks wrong, verify only user messages are used for origin mapping and fork cards are ordered by source message index.
- If chat split flashes from fallback width before settling, verify width is read once at mount and a skeleton is shown until hydration completes.
- If chat resize causes jitter or repeated layout thrash, verify persisted width writes do not also drive continuously mutating reactive size state during drag.
- If chat re-expands at the wrong size, verify expand flow re-reads `workspace.chat.size` before remounting the split layout.
- If fork-origin highlights look incorrect in the `Forks` tab, verify parent message timestamps are available and nearest-prior user-message selection is applied.
- If simplified review should show one lineage but multiple families appear, verify root-family filtering is limited to the most recently updated fork family.
- If the theme flips back to dark on refresh, verify `workspace.theme` is persisted and read before shell render.
- If light mode appears active but canvas still looks dark, verify canvas background color is explicitly set for light mode in both Context and Forks views.
- If switching between Context and Forks drops zoom or layout state, verify tab switching hides/shows mounted canvases instead of remounting instances.
- If real no-mock streaming E2E is skipped unexpectedly, verify `OPENCODE_E2E_REAL=1` is set in the test command environment.
- If Workflows view shows no invocations, verify Restate is running locally and invocation list APIs can call `restate invocations list --all`.
- If Workflows detail cards do not populate after selecting one invocation, verify the workflow output endpoint has reached terminal output and invocation detail API receives the selected workflow id.
