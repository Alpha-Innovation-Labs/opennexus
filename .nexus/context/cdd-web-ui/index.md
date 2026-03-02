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

The graph experience includes an OpenCode side panel plus keyboard-driven chat modals (`Ctrl/Cmd+N` for a new single chat, `Ctrl/Cmd+A` for dual-lane parallel chat, `Ctrl/Cmd+S` for branch forking), and a header-level `Forks` lineage graph viewer with diff-style fork-origin snippets.

Chat-capable flow surfaces now share one reusable `llm-conversation` feature for conversation listing, message history loading, prompt sending, streaming updates, and tool-call replay behavior.

Workspace navigation is path-based (`/context`, `/forks`, `/chats`, `/workflows`) and chats support deep links at `/chats/:conversation_id` while the right chat panel remains independently selectable.

When `Chats` view is active, the global right chat sidebar is intentionally hidden and the full conversation surface is rendered in the center pane.

Chat list and transcript hydration use session-storage cache first and then reconcile with latest server state while showing a lightweight syncing indicator.

Chat presentation now uses compact inline rows for `read`/`grep`/`glob` tools, input-summary collapsed headers for other tool calls, output-first expanded tool cards, diff-focused rows for `apply_patch`, a compact token-aware header, an integrated auto-grow composer, and an opaque sticky previous-user context banner while scrolling.

Chat surface theming now uses harness-agnostic tokens (`--chat-*` and `--tool-*`) so future non-OpenCode harnesses can reuse the same conversation UI contract.

Tool-row truncation now derives from live chat-pane width (not fixed breakpoints), and `apply_patch` rendering now groups assistant-segment patch sequences into one repository-relative file tree plus selected-file Pierre diff view.

Large `apply_patch` sections now start in a bounded collapsed state and use a bottom arrow control to expand/collapse in place.

The sticky previous-user banner now exposes a hover-only prior-turn history menu, keeps the menu open while pointer focus stays within the combined banner/menu surface, and supports click-to-jump transcript navigation per history row.

Chats now support right-click row context actions (open, split open, delete) and OpenCode attachment rendering beneath user messages, including image thumbnail previews with click-to-open dialogs.

Conversation UI implementation is now expected to evolve as decomposed feature-scoped modules (components/hooks/libs) rather than one oversized panel file.

The workspace keeps a persistent right-side chat shell while center views (Context/Forks/Chats/Workflows) change, and chat width restore-on-expand uses saved local state.

The workspace shell keeps the left sidebar as a full-height column while top navigation, main content, and right chat are composed inside one encapsulated container; primary view navigation remains in the top nav and sidebar content changes with the active view.

The flow UI also includes a `Workflows` view for invocation observability, with left-sidebar invocation selection and main-panel workflow status plus step-result details.

Theme controls now live in the top-right navbar as a single icon toggle (sun/moon), and selected mode persists across refresh while graph canvas backgrounds follow the active theme.

The top-right navbar also includes a two-option theme variant picker (`Current Theme`, `TUI Theme`) and defaults to the TUI variant for new sessions.

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

# Run chats sidebar selection no-refetch regression e2e
bun --cwd apps/react-flow run test:e2e -- e2e/chats-sidebar-selection-no-refetch.e2e.ts

# Start local OpenCode server required by forks APIs
opencode serve --port 4096

# Run canvas theme persistence + light-mode color e2e
bun --cwd apps/react-flow run test:e2e -- e2e/canvas-theme-light-mode.e2e.ts

# Initialize shadcn in this app (run once)
bunx --bun shadcn@latest init --defaults --base-color neutral

# Install/refresh shadcn UI primitives through CLI
bunx --bun shadcn@latest add button dialog badge card resizable skeleton

# Add Pierre Diffs dependency used for code-modification tool output rendering
bun --cwd apps/react-flow add @pierre/diffs

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
- If panel, modal, and preview chat behavior diverges, verify those surfaces use the shared `llm-conversation` feature contract instead of local duplicated transport logic.
- If selecting a chat looks like a full refresh, verify route navigation is client-side and distinguish shell remount issues from in-surface rerender/loading updates.
- If center and right chat panes show different transcripts, verify this is expected: center follows `/chats/:conversation_id`, right panel keeps its own selected conversation.
- If right chat sidebar still appears in `/chats/:conversation_id`, verify chats view routing path disables global right panel rendering.
- If `/chats/:conversation_id` shows hydration mismatch warnings, verify browser-only cache/theme initialization runs post-mount and server/client first render stay deterministic.
- If a chat route crashes on tool output rendering, verify patch-like tool output paths degrade safely instead of invoking single-file diff rendering on multi-file patches.
- If conversation-related changes are hard to review safely, verify panel logic is split into feature-scoped single-concern files (`components/`, `hooks/`, `lib/`).
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
- If chat colors drift in TUI mode, verify conversation/title/input/user-message backgrounds and borders are sourced from theme tokens rather than hardcoded component values.
- If the top navbar still shows an activity-collapse control, verify workspace top-nav only exposes sidebar toggle, theme variant selector, and light/dark toggle actions.
- If light mode appears active but canvas still looks dark, verify canvas background color is explicitly set for light mode in both Context and Forks views.
- If switching between Context and Forks drops zoom or layout state, verify tab switching hides/shows mounted canvases instead of remounting instances.
- If real no-mock streaming E2E is skipped unexpectedly, verify `OPENCODE_E2E_REAL=1` is set in the test command environment.
- If Workflows view shows no invocations, verify Restate is running locally and invocation list APIs can call `restate invocations list --all`.
- If Workflows detail cards do not populate after selecting one invocation, verify the workflow output endpoint has reached terminal output and invocation detail API receives the selected workflow id.
- If startup logs show many `/api/orchestration/status` calls, verify this is expected per-context status fanout and consider active-view-gated status loading when reducing noise.
- If startup logs show frequent `/api/opencode/conversations/:id/messages` calls, verify polling cadence and shared conversation hook dependencies/defaults are referentially stable.
- If markdown list bullets do not match TUI colors, verify `--md-list-item` and `--md-list-enumeration` are set and `.opencode-markdown *::marker` styling is active.
- If token usage indicator shows no details on hover, verify shadcn tooltip wiring and hover trigger are mounted in the panel header.
- If attachment chips do not appear for messages that include directories/files, verify OpenCode file parts are normalized into attachment metadata before UI rendering.
- If image attachments do not preview, verify attachment MIME classification marks `image/*` parts and image URLs are present in the normalized payload.
- If split chats do not restore after reload, verify `workspace.chats.split.state` and orientation-specific split layout keys are written/read from local storage.
- If sticky previous-user history closes while moving pointer from banner into the history menu, verify hover-open state is bound to the shared banner/menu container rather than banner-only hover selectors.
- If clicking a sticky history row does not jump to the expected turn, verify row click handlers target message elements by `data-chat-message-id` within the active transcript viewport.
- If compact `read`/`grep`/`glob` rows overflow in narrow panes, verify label max-width is derived from current transcript container width and labels keep `truncate`/hover-title behavior.
- If consecutive `apply_patch` calls are not grouped as expected, verify grouping is limited to one assistant segment and resets after the next user message.
- If `apply_patch` tree paths start at `/Users/...` instead of repo-relative paths, verify patch path normalization strips absolute prefixes to the repository root.
- If collapsed `apply_patch` sections occupy too much space or cannot be reopened, verify bounded collapsed height and bottom-arrow expand/collapse control are active.
