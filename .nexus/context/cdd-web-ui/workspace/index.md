---
project_id: cdd-web-ui-workspace
title: CDD Web UI Workspace
created: "2026-02-27"
status: active
dependencies:
  - cdd-web-ui
  - nexus-adapter
  - nexus-cli
---

# cdd-web-ui workspace

## Scope

Owns the interactive web workspace for selecting a context `Next Actions` line, triggering backend generation and implementation workflow, inspecting persisted task results, and watching active session progress.

Run the workspace locally with `just web` from the repository root.

## Context Files

| ID | Title |
|----|-------|
| CWB_001 | Workspace Next Action Execution |
| CWB_002 | Workspace Task Status Results |
| CWB_003 | Workspace Live Session Stream |
| CWB_004 | Workspace Context File Tree and Center Markdown View |
| CWB_005 | Workspace Markdown Rendering and Editing Surface |
| CWB_006 | Workspace Context File API Safety and Conflict Handling |
| CWB_007 | Workspace Sidebar Selection Sync and Unsaved Change Guards |

## Interfaces

| Interface | Description |
|-----------|-------------|
| `Select Next Action` | Operator picks one row from a context file and starts execution |
| `Task Result Panel` | Operator sees persisted implemented/failed/missing status for selected row |
| `Live Session Panel` | Operator views in-progress provider session output and task progress |
| `Chats Sidebar Selection` | Operator selects a chat session in the left sidebar and sees that transcript in the center panel |

## Dependencies

| Dependency | Purpose |
|------------|---------|
| `cdd-web-ui` | Provides the parent UI project contract and operator workflows this feature extends |
| `nexus-adapter` | Provides typed execution and query bridge used by workspace controls |
| `nexus-cli` | Provides orchestration and status command behavior surfaced by workspace actions |

## Troubleshooting

- If execution button fails, verify backend command and context path resolution.
- If result panel is empty for completed work, verify task status was persisted in SQLite.
- If live stream does not update, verify provider session records are attached to the selected task.
- If the web app is unavailable, rerun `just web` and inspect `logs/web.log`.
- If chat rows overflow the left sidebar, verify row titles use single-line ellipsis truncation and list containers suppress horizontal bleed.
- If long chats/workflow lists do not scroll correctly, verify sidebar list rendering uses shadcn `ScrollArea` and not ad-hoc overflow containers.
- If selecting a chat feels like a full reload, verify center transcript mode does not run background polling and sidebar selection does not re-fetch the session list.
- If chat selection visibility is weak in TUI mode, verify sidebar uses `#141414`-aligned panel background with a higher-contrast background-only selected row state.
