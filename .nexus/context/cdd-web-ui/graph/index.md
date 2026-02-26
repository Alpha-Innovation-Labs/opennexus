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
| `Resizable Split Layout` | Operator can drag the graph/conversation separator and expand conversation width up to half the viewport |

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
- If panel resize cannot reach half viewport, verify split sizing constraints are configured with percentage units and max size allows `50%`.
