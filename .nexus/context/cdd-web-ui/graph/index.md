---
project_id: cdd-web-ui-graph
title: CDD Web UI Graph
created: "2026-02-27"
status: active
dependencies:
  - cdd-web-ui
  - nexus-cli
---

# cdd-web-ui graph

## Scope

Owns the graph visualization experience for context files using React Flow, including project grouping, dependency edges, automatic organization, and context detail inspection.

The graph runs as a full-screen canvas and supports mode-based interaction for selection, move, and resize operations.

## Context Files

| ID | Title |
|----|-------|
| CWG_001 | Graph Context Source Discovery and Normalized View Model |
| CWG_002 | Project Group Nodes and Context File Node Rendering |
| CWG_003 | Dependency Edge Mapping and Cross-Project Linking |
| CWG_004 | Graph Auto-Layout and Stable Re-Layout Behavior |
| CWG_005 | Context Node Detail Modal and Content Preview |
| CWG_006 | OpenCode Conversation Panel and Repository-Scoped Session Listing |
| CWG_007 | Shadcn Installation Baseline and Resize Hydration Guardrails |
| CWG_008 | Workflow Invocation Sidebar and Step Detail Observability |
| CWG_009 | Reusable LLM Conversation Feature for Panel Modal and Preview |

## Interfaces

| Interface | Description |
|-----------|-------------|
| `Project Graph View` | Operator sees projects as group containers and context files as child nodes |
| `Project Overview Layout` | Operator sees project subflows arranged top-to-bottom by Dagre in project mode |
| `Project Overview Labels` | Operator sees subproject row text derived from feature `index.md` title metadata with feature-key fallback |
| `Dependency Links` | Operator sees directed links between context nodes based on blocking dependencies |
| `Project Dependency Links` | Operator sees project-to-project edges in project mode when cross-project blocking links exist |
| `Context Detail Modal` | Operator opens a popup to inspect selected context markdown content |
| `Interaction Modes` | Operator switches between Select, Move, and Resize modes via buttons or keyboard shortcuts |
| `Keyboard Navigation` | Operator navigates nodes with `h/j/k/l`, jumps subflows with `Shift+h/j/k/l`, resets focused subflow with `Shift+r`, and exits edit state with `Esc` |
| `Local Persistence` | Operator layout edits and viewport state persist in local storage between reloads |
| `Mode-Specific Open` | Operator opens detail modal with Enter only while Select mode is active |
| `Project Overview Rows` | Operator sees one subproject row per feature inside each project shell in project mode |
| `Subproject Icon Stats` | Operator sees per-row icon counts for total context files and adapter-authored context files |
| `OpenCode Conversation Panel` | Operator sees a right-side conversation panel for creating, selecting, and continuing OpenCode sessions |
| `Repository-Scoped Conversation Selector` | Operator sees only sessions associated with the current repository directory |
| `Tool Call Trace` | Operator sees expandable tool call entries with compact icon-first headers plus input/output/error details inside assistant messages |
| `Code Modification Diff View` | Operator sees patch-style visual diffs for code-modifying tool outputs when patch payloads are available |
| `Forks Tab` | Operator switches from Projects to Forks and sees a lineage-focused graph of one fork family during simplified mode |
| `Fork Origin Snippet` | Operator sees diff-style message snippets that highlight the likely fork source message and mute skipped context |
| `Fork Origin Border Bullets` | Operator sees border-aligned source bullets on highlighted root transcript lines where fork edges originate |
| `Fork-Origin Ordered Fork Nodes` | Operator sees fork cards ordered top-to-bottom by the source message order in the root transcript |
| `User-Only Fork Transcript` | Operator sees only user turns in the root transcript used for fork-origin mapping |
| `Fork Conversation Modal` | Operator opens full fork conversation history by double-clicking a fork conversation node |
| `Navbar Theme Toggle` | Operator flips light/dark mode from a single navbar icon button and sees icon inversion based on current mode |
| `Theme Variant Picker` | Operator switches between Current and TUI theme variants from the top-right navbar selector |
| `Theme-Persistent Canvas` | Operator refreshes and retains the selected theme with matching canvas background color for the active mode |
| `Non-Remount Tab Swap` | Operator switches Context/Forks tabs without remounting graph canvases so prior viewport/state remains intact |
| `Resizable Split Layout` | Operator can drag the graph/conversation separator and expand conversation width up to half the viewport |
| `Scope Breadcrumb` | Operator sees a compact top-left breadcrumb that reflects current project and focused sub-scope |
| `Shortcut New Chat Modal` | Operator opens a new-chat dialog with Ctrl/Cmd+N using the same chat surface as the sidebar panel |
| `Shortcut Parallel Chat Modal` | Operator opens a dual-lane dialog with Ctrl/Cmd+A and drives both lanes from one shared composer |
| `Streaming Recovery Fallback` | Operator still sees assistant text when stream deltas are missing by recovering from latest persisted messages |
| `Reusable LLM Conversation Feature` | Operator gets consistent fetch/send/stream chat behavior across panel, modal lanes, and preview surfaces through one shared feature contract |
| `Path-Segment View Routing` | Operator navigates workspace views via `/context`, `/forks`, `/chats`, `/workflows` and deep-links center chat with `/chats/:conversation_id` |
| `Session Cache First Chat Hydration` | Operator sees cached conversations/messages immediately from session storage while UI shows a syncing indicator for latest server refresh |
| `Compact Chat Header and Composer` | Operator sees title + token metrics with icon-only controls, plus one integrated auto-grow composer with send-only action |
| `Sticky Previous User Context` | Operator sees an opaque sticky banner with the previous user turn for the currently visible transcript region |
| `Minimal Assistant Stream Chrome` | Operator sees assistant markdown/tool stream without outer message boxes while tool rows remain boxed and collapsible |
| `TUI Conversation Surface Token` | Operator sees chat transcript surfaces themed by a shared TUI conversation background token |
| `Shortcut Fork Modal` | Operator opens a forked-chat modal from the active conversation with Ctrl/Cmd+S |
| `Composer Fork Fallback` | Operator can fork the active conversation from a Fork button next to Send when shortcuts are unavailable |
| `Forks Header Button` | Operator opens a conversation lineage graph modal from the panel header via `Forks` |
| `Lane-Local Composers` | Operator sends prompts independently in each branch lane without broadcasting across all lanes |
| `Message-Point Forking` | Operator forks from a specific user message inside a lane to create deeper branch descendants |
| `User Message Fork Icon` | Operator uses a fork icon in the top-right of user bubbles and no longer relies on header-level fork/new action icons |
| `Fork Origin Highlight` | Operator sees the exact message that produced a branch with distinct background treatment |
| `Token Ring Tooltip` | Operator sees compact token-usage ring in header and hover tooltip with remaining and used token values |
| `Persistent Chat Shell` | Operator keeps one right-side chat sidebar location/size while center workspace views change |
| `Chat Width Restore on Expand` | Operator collapses and re-expands chat sidebar and gets the prior saved width |
| `Chat Resize Hydration Guard` | Operator avoids first-frame width flicker by reading saved chat size once at mount before rendering split panes |
| `Workflows Sidebar` | Operator sees workflow invocations in the left sidebar and selects one to inspect |
| `Workflow Step Details` | Operator sees readable invocation metadata and labeled step outputs in the main panel |
| `Workflows Loading Skeletons` | Operator sees skeleton placeholders while workflow invocation and detail data is loading |

## Dependencies

| Dependency | Purpose |
|------------|---------|
| `cdd-web-ui` | Provides the parent UI project contract and graph entry points this feature implements |
| `nexus-cli` | Provides context metadata and dependency semantics rendered by graph views |

## Troubleshooting

- If project groups are empty, verify context discovery and frontmatter parsing completed successfully.
- If expected context nodes are missing, verify project and feature `index.md` files are intentionally excluded from node rendering.
- If dependencies are missing, verify `depends_on.contexts` values resolve to known context ids or canonical paths.
- If dependencies still look absent, verify `depends_on.contexts` entries use object form (`id`, `why`) or string values that resolve to loaded context ids.
- If project dependency direction looks inverted, verify project overview aggregation uses prerequisite -> dependent semantics from context `depends_on.contexts`.
- If project overview edges are missing, verify at least one cross-project context dependency exists after normalization.
- If project overview edge colors differ, verify project edge styling is configured to one shared color token across all project edges.
- If same-rank project cards start at different top positions, verify row-top alignment normalization is applied after Dagre placement.
- If subflow reset unexpectedly changes canvas location, verify reset behavior preserves group position while restoring child layout and group dimensions.
- If keyboard shortcuts do not trigger modes or navigation, click the canvas once to restore keyboard focus.
- If Enter opens details while Move/Resize is active, verify mode indicator and ensure Select mode is required for keyboard modal open.
- If subflow reset does not restore expected size, verify refresh was triggered on the intended focused subflow.
- If project overview rows overlap or clip after reload, clear stale local storage and verify shell-size rehydrate self-heal is active.
- If subproject cards drift from computed layout, verify fixed non-draggable overview child nodes are excluded from geometry persistence.
- If project subflow dragging appears blocked too early, verify collision margin tuning is aligned with current card dimensions.
- If project subflows still overlap after drag, verify move-mode collision handling reverts only the moved node and keeps sibling positions unchanged.
- If card text appears cramped, verify compact card constraints (250px width, line-aware height) are active in the current build.
- If node detail modal is blank, verify file read API returns markdown for selected context path.
- If subproject labels show raw feature keys unexpectedly, verify feature `index.md` title metadata is present and parsed for the relevant feature folder.
- If conversation selector is empty or `502` appears, verify OpenCode server reachability and panel API base URL resolution.
- If creating or listing conversations fails for this repo, verify repository directory scoping is passed to OpenCode session endpoints.
- If assistant replies only appear after page reload, verify the panel message POST route emits SSE `delta` events and a terminal `done` event for the active conversation.
- If streamed replies still render as `(No text response)`, verify SSE frame parsing handles both LF (`\n\n`) and CRLF (`\r\n\r\n`) delimiters.
- If assistant text appears but tool traces are missing, verify streaming emits `tool` events and assistant messages include tool parts when fetched from history.
- If tool rows never leave `running`, verify tool state updates are being upserted per `callId` as new stream frames arrive.
- If highlighted fork-origin rows look incorrect, verify parent conversation message timestamps are available and fork origin selection prefers the nearest prior user message.
- If fork graph shows multiple unrelated families during simplified review mode, verify only the most recently updated root family is selected.
- If double-click on fork node does not open history, verify interaction is bound to fork session nodes and not group/anchor nodes.
- If forks view shows `Unable to list forked OpenCode conversations: fetch failed`, verify OpenCode server is running and reachable on `OPENCODE_BASE_URL`.
- If one trunk line appears to connect unrelated forks, verify edge routing uses per-fork source handles from matched root transcript bullets.
- If fork cards appear out of origin order, verify sorting prioritizes matched root message index before updated timestamp.
- If dragging forks stops canvas panning (or vice versa), verify fork node drag and canvas pan are both enabled in React Flow interaction config.
- If graph theme resets to dark after refresh, verify `workspace.theme` persistence is read before first render and navbar toggle state matches stored mode.
- If light mode still shows a dark canvas, verify explicit light-mode canvas background is applied to both Context and Forks graph canvases.
- If switching Context/Forks tabs resets zoom, layout, or selection unexpectedly, verify canvases are kept mounted and only visibility is toggled.
- If parallel chat lane headers show fallback IDs instead of descriptive names, verify OpenCode session creation returns titles and lane labels refresh from server responses.
- If one chat surface behaves differently than another for the same conversation, verify all surfaces use the shared `llm-conversation` feature APIs/hooks instead of local transport logic.
- If center and right chat panes show different conversations, verify center follows `/chats/:conversation_id` and right panel remains intentionally independent.
- If chat appears stale right after open, verify session-storage hydration is active and `Syncing latest` indicator clears after server reconciliation.
- If `/chats/:conversation_id` reports hydration mismatch, verify browser-only cache/theme reads are deferred until after mount and SSR markup is deterministic.
- If chat route throws a client exception on tool diffs, verify patch-like tool output falls back to safe text rendering for multi-file patches.
- If parallel lanes show `(No text response)` while backend generated a reply, verify no-delta recovery fetch reads latest assistant messages after stream completion.
- If Ctrl/Cmd+N or Ctrl/Cmd+A does not open chat modals, verify graph page focus is active and no browser/system shortcut handler is overriding the keybinding.
- If Ctrl/Cmd+S does not fork the active conversation, use the Fork button next to Send and verify conversation selection is non-empty.
- If forked lanes appear but `Forks` graph is empty, verify fork creation uses native OpenCode session fork metadata (parent linkage) rather than replay-created standalone sessions.
- If branch intent is unclear in a lane, verify the fork-origin message highlight is present on the message used for branching.
- If chat split briefly shows an incorrect initial width before settling, verify width hydration is mount-only and gated by a skeleton while storage loads.
- If chat resize feels jittery, verify persisted width writes do not feed back into continuously changing reactive panel-size state during the same drag.
- If chat re-expands at an unexpected size, verify expand behavior re-reads persisted `workspace.chat.size` before restoring the split layout.
- If panel resize cannot reach expected width in workspace split views, verify split sizing constraints are configured with percentage units and intended max-size guardrails.
- If Workflows view sidebar is empty, verify Restate is reachable and invocation list query returns records for `ConversationWorkflow`.
- If Workflows detail panel stays blank after selecting an invocation, verify invocation detail query includes a valid `workflowId` and output endpoint is available.
- If `/api/opencode/conversations/:id/messages` repeats excessively while idle, verify shared LLM conversation hook defaults/dependencies are referentially stable and polling is scoped to active surfaces.
- If workflow output fetch returns pending state, verify the selected invocation reached a terminal status before expecting step output payloads.
- If code-modifying tool calls still show raw text instead of diffs, verify Pierre Diffs patch extraction path can read patch payloads from tool input/output.
- If list marker colors do not match TUI expectations, verify markdown marker CSS uses `--md-list-item` and `--md-list-enumeration` tokens.
