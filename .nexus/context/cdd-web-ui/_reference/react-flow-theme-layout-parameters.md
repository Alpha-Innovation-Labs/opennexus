# React Flow UI Theme and Layout Parameter Inventory

Last updated: 2026-02-28
Scope: `apps/react-flow`

## Investigation Method

This inventory combines:

1. Static code inspection across `apps/react-flow/src/**` (CSS variables, React Flow config, node sizing/layout constants, shell sizing).
2. Runtime verification with `agent-browser` on `http://localhost:4174/context`:
   - Theme mode toggle and theme variant selector behavior.
   - Computed CSS variable values (`agent-browser eval` with `getComputedStyle`).
   - Runtime canvas/node positioning and panel geometry.
3. Chat-route verification on `http://localhost:4174/chats/:conversation_id`:
   - Context menu interactions on chat rows.
   - Center-first chat layout without global right sidebar in `Chats` view.
   - Message/tool rendering behavior (inline tool rows, sticky prior-user context, diff rendering fallbacks).

## 1) Theme Variable Sources (Authoritative Files)

- Global design tokens and React Flow variable bridge: `apps/react-flow/src/styles/globals.css`
- Theme mode/variant persistence and DOM wiring: `apps/react-flow/src/features/workspace-shell/components/workspace-shell-layout.tsx`
- Theme controls UI: `apps/react-flow/src/features/workspace-shell/components/workspace-top-nav.tsx`
- Runtime theme observer hook: `apps/react-flow/src/shared/hooks/use-theme-mode.ts`
- Runtime theme variant observer hook: `apps/react-flow/src/shared/hooks/use-theme-variant.ts`
- Context graph canvas color fallback + viewport behavior: `apps/react-flow/src/features/context-graph/components/context-graph-canvas.tsx`
- Fork graph canvas color fallback + viewport behavior: `apps/react-flow/src/features/opencode-panel/components/opencode-fork-graph-canvas.tsx`
- Markdown/syntax theme usage in OpenCode panel: `apps/react-flow/src/features/opencode-panel/components/opencode-conversation-panel.tsx`
- App-wide font wiring: `apps/react-flow/src/app/layout.tsx`

### 1.1 Global font application contract

- The app uses Next Font `Geist` as the global sans family.
- Effective wiring requires both classes on `<body>`:
  - `geistSans.variable` to expose `--font-geist-sans`
  - `geistSans.className` to apply Geist as the actual rendered font family
- `globals.css` maps `--font-sans` to `var(--font-geist-sans), "Avenir Next", "Segoe UI", sans-serif`.

## 2) Complete CSS Variable Inventory

### 2.1 Base design tokens (`@theme`)

Defined in `apps/react-flow/src/styles/globals.css`:

- Typography/shape
  - `--font-sans`
  - `--radius`
- Core semantic color tokens
  - `--color-background`
  - `--color-foreground`
  - `--color-card`
  - `--color-card-foreground`
  - `--color-popover`
  - `--color-popover-foreground`
  - `--color-primary`
  - `--color-primary-foreground`
  - `--color-secondary`
  - `--color-secondary-foreground`
  - `--color-muted`
  - `--color-muted-foreground`
  - `--color-accent`
  - `--color-accent-foreground`
  - `--color-border`
  - `--color-input`
  - `--color-ring`
  - `--color-destructive`
- Background band tokens
  - `--color-bg-band-1`
  - `--color-bg-band-2`
  - `--color-bg-separator`
- Edge palette tokens
  - `--color-edge-blue`
  - `--color-edge-green`
  - `--color-edge-pink`

### 2.2 Theme-scope utility variables (`:root`, `.dark`, variant scopes)

- Canvas and grouping
  - `--grid-dot-color`
  - `--flow-canvas-bg`
  - `--subflow-bg`
  - `--flow-edge`
- Markdown/readability palette
  - `--md-text`
  - `--md-heading`
  - `--md-link`
  - `--md-link-text`
  - `--md-code`
  - `--md-quote`
  - `--md-emph`
  - `--md-strong`
  - `--md-list-item`
  - `--md-list-enumeration`
- Code/syntax palette
  - `--syntax-comment`
  - `--syntax-keyword`
  - `--syntax-function`
  - `--syntax-variable`
  - `--syntax-string`
  - `--syntax-number`
  - `--syntax-type`
  - `--syntax-operator`
  - `--syntax-punctuation`
- OpenCode chat surface/composer
  - `--opencode-input-bg`
  - `--opencode-input-area-bg`
  - `--opencode-composer-border`
  - `--opencode-composer-chip-bg`
  - `--chat-surface-bg`
- Workspace shell
  - `--workspace-sidebar-bg`

### 2.3 XYFlow bridge variables (`.react-flow`)

These are the concrete variables XYFlow consumes, all set in `apps/react-flow/src/styles/globals.css`:

- Edges and connection line
  - `--xy-edge-stroke-default`
  - `--xy-edge-stroke-width-default`
  - `--xy-edge-stroke-selected-default`
  - `--xy-connectionline-stroke-default`
  - `--xy-connectionline-stroke-width-default`
- Minimap
  - `--xy-minimap-background-color-default`
  - `--xy-minimap-mask-background-color-default`
  - `--xy-minimap-mask-stroke-color-default`
  - `--xy-minimap-mask-stroke-width-default`
  - `--xy-minimap-node-background-color-default`
  - `--xy-minimap-node-stroke-color-default`
  - `--xy-minimap-node-stroke-width-default`
- Canvas background/pattern
  - `--xy-background-color-default`
  - `--xy-background-pattern-dots-color-default`
  - `--xy-background-pattern-lines-color-default`
  - `--xy-background-pattern-cross-color-default`
- Node and selection
  - `--xy-node-color-default`
  - `--xy-node-border-default`
  - `--xy-node-background-color-default`
  - `--xy-node-group-background-color-default`
  - `--xy-node-boxshadow-hover-default`
  - `--xy-node-boxshadow-selected-default`
  - `--xy-node-border-radius-default`
  - `--xy-handle-background-color-default`
  - `--xy-handle-border-color-default`
  - `--xy-selection-background-color-default`
  - `--xy-selection-border-default`
- Controls and edge labels
  - `--xy-controls-button-background-color-default`
  - `--xy-controls-button-background-color-hover-default`
  - `--xy-controls-button-color-default`
  - `--xy-controls-button-color-hover-default`
  - `--xy-controls-button-border-color-default`
  - `--xy-controls-box-shadow-default`
  - `--xy-edge-label-background-color-default`
  - `--xy-edge-label-color-default`
  - `--xy-resize-background-color-default`
  - `--xy-attribution-background-color-default`

### 2.4 Radius derivations (`@theme inline`)

- `--radius-sm`
- `--radius-md`
- `--radius-lg`
- `--radius-xl`
- `--radius-2xl`
- `--radius-3xl`
- `--radius-4xl`

## 3) Palette Values by Mode/Variant

### 3.1 Mode/variant selectors

- Theme mode (`light`/`dark`) is persisted in local storage key `workspace.theme` and applied by toggling `document.documentElement.classList.toggle("dark", ...)`.
- Theme variant (`maroon`/`cursor`/`nexus`) is persisted in local storage key `workspace.theme.variant` and applied as `document.documentElement.dataset.themeVariant`.
- Default theme variant is `nexus` when no stored value exists.
- Legacy stored values are migrated at read-time:
  - `current` -> `maroon`
  - `tui` -> `cursor`

### 3.2 Runtime-verified computed values (agent-browser)

Observed with `agent-browser eval`:

- Dark + `maroon`
  - `--color-background`: `#151313`
  - `--color-foreground`: `#f6f3f3`
  - `--flow-canvas-bg`: `#1a1717`
  - `--subflow-bg`: `#231f1f`
  - `--color-edge-blue`: `#93e9f6`
  - `--flow-edge`: `#93e9f6`
  - `--xy-background-color-default`: `#1a1717`
- Dark + `cursor`
  - `--color-background`: `#0a0a0a`
  - `--color-secondary`: `#5c9cf5`
  - `--color-accent`: `#9d7cd8`
  - `--flow-canvas-bg`: `#141414`
  - `--subflow-bg`: `#1e1e1e`
  - Edge palette: `#5c9cf5`, `#7fd88f`, `#9d7cd8`
- Dark + `nexus`
  - `--color-background`: `#0a0a0a`
  - `--opencode-input-area-bg`: `#1d1d1d`
  - `--chat-surface-bg`: `#0a0a0a`
  - `--workspace-sidebar-bg`: `#141414`
- Light + `cursor` selected (variant retained, no `.dark` class)
  - `documentElement.className`: empty
  - `--color-background`: light OKLCH-derived value (computed browser color-space string)
  - `--flow-canvas-bg`: light root value (OKLCH-derived)
  - `--grid-dot-color`: `#94a3b8`

## 4) Layout and Position Parameters (Context/Forks/Workspace)

## 4.1 Context graph canvas interaction/layout constants

From `apps/react-flow/src/features/context-graph/components/context-graph-canvas.tsx`:

- Persistence key: `FLOW_STORAGE_KEY = "cdd-react-flow-ui/state/v10"`
- Keyboard nudges
  - `KEYBOARD_MOVE_STEP = 24`
  - `KEYBOARD_MOVE_STEP_FAST = 72`
- Grid and viewport
  - `snapGrid = [24, 24]`
  - `fitViewOptions = { padding: 0.12, minZoom: 0.28 }`
  - `minZoom = 0.2`
  - `maxZoom = 1.8`
  - Background dots: `gap = 20`, `size = 2`
- Interaction sizing helpers
  - `CONTEXT_NODE_WIDTH = 340`
  - `CONTEXT_NODE_HEIGHT = 108`
  - `COLLAPSED_GROUP_HEIGHT = 88`
  - `COLLISION_MARGIN = 8`
- Overlay panel offsets/classes
  - Controls: `!bottom-4 !right-[220px]`
  - Secondary panel: `!bottom-4 !right-[380px]`
  - Breadcrumb panel: `!left-4 !top-4`

## 4.2 Context layout engine constants (Dagre + group sizing)

From `apps/react-flow/src/features/context-graph/services/context-graph-layout-service.ts`:

- Group shell dimensions
  - `GROUP_MIN_WIDTH = 380`
  - `GROUP_MIN_HEIGHT = 620`
  - `GROUP_HEADER_HEIGHT = 62`
  - `GROUP_PADDING_X = 20`
  - `GROUP_PADDING_RIGHT = 20`
  - `GROUP_PADDING_BOTTOM = 24`
  - `GROUP_GAP_X = 80`
  - `FEATURE_GROUP_GAP_Y = 24`
- Project-level paddings
  - `PROJECT_GROUP_PADDING_TOP = 16`
  - `PROJECT_GROUP_PADDING_BOTTOM = 20`
- Project overview shell
  - `PROJECT_OVERVIEW_SHELL_WIDTH = 380`
  - `PROJECT_OVERVIEW_SHELL_MIN_HEIGHT = 120`
  - `PROJECT_OVERVIEW_ITEM_HEIGHT = 72`
  - `PROJECT_OVERVIEW_ITEM_GAP = 12`
  - `PROJECT_OVERVIEW_INNER_PADDING_TOP = 16`
  - `PROJECT_OVERVIEW_INNER_PADDING_BOTTOM = 24`
- Context card footprint
  - `CARD_MAX_WIDTH = 250`
  - `CARD_ONE_LINE_HEIGHT = 65`
  - `CARD_TWO_LINE_HEIGHT = 75`
- Dagre spacing in-context
  - `nodesep = 32`
  - `ranksep = 56`
- Dagre spacing in project overview
  - `nodesep = 56`
  - `ranksep = 72`
- Edge style defaults emitted by layout service
  - Type: `smoothstep`
  - Stroke dash: `"12 8"`
  - Width: `2.4` (project overview) or `2` (detail graph)
  - Stroke color source: `pickEdgeColor -> var(--color-edge-blue)`

## 4.3 Collision service tuning

From `apps/react-flow/src/features/context-graph/services/context-graph-collision-service.ts`:

- `DEFAULT_NODE_WIDTH = 240`
- `DEFAULT_NODE_HEIGHT = 96`
- `hasSiblingCollision` default margin: `14`
- `resolveNodeCollisions` defaults
  - `margin = 14`
  - `maxIterations = 120`

## 4.4 Fork graph layout constants

From `apps/react-flow/src/features/opencode-panel/components/opencode-fork-graph-canvas.tsx`:

- Root transcript placement
  - `ROOT_TRANSCRIPT_WIDTH = 620`
  - `ROOT_X = 80`
  - `ROOT_Y = 80`
- Fork cards placement
  - `FORK_X = 860`
  - `FORK_Y = 80`
  - `FORK_ROW_GAP = 120`
  - Card size: width `300`, height `92`
- Graph viewport behavior
  - `fitViewOptions = { padding: 0.16, minZoom: 0.24 }`
  - `minZoom = 0.2`
  - `maxZoom = 1.6`
  - Background dots: `gap = 20`, `size = 2`
- Edge style
  - Stroke color: `var(--flow-edge)`
  - Width: `1.6`

## 4.5 Workspace shell and panel dimensions

From workspace shell components:

- Left sidebar width
  - Expanded: `w-[280px] min-w-[280px]`
  - Collapsed: `w-0 min-w-0`
- Right chat panel persistence (non-`Chats` views)
  - Local storage keys: `workspace.chat.size`, `workspace.chat.collapsed`
  - Default size fallback: `32%`
  - Resizable split defaults: `${100 - initialChatPanelSize}%` and `${initialChatPanelSize}%`
- Chats view shell behavior
  - `currentView === "chats"` returns center-only content and skips mounting the global right sidebar.
  - Center chat uses the full `OpencodeConversationPanel` surface bound to route-selected conversation id.
- Chats center split persistence
  - Split state key: `workspace.chats.split.state`
  - Split layout keys: `workspace.chats.split.layout.vertical`, `workspace.chats.split.layout.horizontal`
  - Split state payload: `{ orientation, conversationId }`
  - Split layout payload: `{ primary, secondary }` (percent values)
- Right sidebar render
  - Border/background: `border-l border-border/70 bg-card/55`
- Left sidebar render
  - Background token: `bg-[var(--workspace-sidebar-bg)]`

## 8) Chat-Surface Runtime Behaviors Added

### 8.1 Chat row interactions

- Chat rows now support right-click context menu actions:
  - `Open chat`
  - `Open in split (vertical)`
  - `Open in split (horizontal)`
  - `Delete chat`
- Hover delete affordance replaces timestamp in the same inline slot.
- Bulk delete and single delete both use confirmation dialog before API deletion.

### 8.2 Header token indicator parameters

- Header renders compact token indicators:
  - used token count
  - usage percentage
  - circular usage ring with tooltip details
- Ring implementation uses SVG circles:
  - radius: `7`
  - stroke width: `2`
  - active stroke: `var(--color-primary)`
  - base stroke: `var(--color-border)`
- Hover tooltip positioning:
  - `side="bottom"`, `align="end"`, `sideOffset={8}`

### 8.3 Message attachment rendering parameters

- Attachment source: OpenCode message parts with `type: "file"` and optional `source` metadata.
- Attachment kind mapping:
  - `source.type in ["directory", "dir"]` -> `dir`
  - `mime startsWith("image/")` -> `image`
  - otherwise -> `file`
- Image attachments:
  - inline thumbnail preview (`h-14`, `w-20`, `object-cover`)
  - click opens modal preview (`max-w-3xl`, image `max-h-[75vh]`, `object-contain`)

### 8.4 Conversation stream rendering details

- Tool call rendering categories
  - Inline single-line (non-collapsible): `glob`, `grep`, `read`
  - Collapsible detailed rows: other tools
  - `apply_patch` special path: one-line patched-file label + diff body section without input/output blocks
  - Inline/collapsible header overflow hardening (required for narrow right-sidebar widths)
    - `text-ellipsis` only works when the label node itself has `overflow-hidden + whitespace-nowrap + text-ellipsis` and is width-constrained.
    - Stable behavior in resizable panes came from deriving tool-label max width from live pane width (via `ResizeObserver`) rather than fixed class-only sizing assumptions.
    - Inline rows now keep icon + label + timestamp in one line while the label receives a runtime max-width budget and hover `title` for full text.
    - Parent chain still requires `min-w-0`/`overflow-hidden` across panel, scroll viewport, thread root, and tool-call container to prevent intrinsic-width expansion.
- Diff rendering path for code-mod tools
  - `apply_patch` payloads are normalized from `*** Begin Patch` format to unified diff where possible.
  - Unified diff chunks are rendered with Pierre Diffs per file patch; fallback remains text preview when parsing fails.
  - Pierre theme mapping is variant-aware:
    - `maroon`/`cursor`: `themeType: system` with `github-dark-default` / `github-light-default`.
    - `nexus`: forced dark rendering with Pierre theme (`pierre-dark`).
  - Internal diff scrolling is now armed only when the diff block is fully visible in the transcript viewport (IntersectionObserver + wheel handoff), preventing premature nested scroll trapping.
- Sticky prior-user banner
  - Floating banner shows a single-line truncated prior user message only (non-expandable).
- User message expansion behavior
  - Long user messages are expandable/collapsible with chevron affordance.
  - Expanded state uses internal `ScrollArea` with bounded max height to prevent transcript overflow.

### 8.5 Chat surface theme variables in active use

- Conversation surface token
  - `--chat-surface-bg` (renamed from `--opencode-conversation-bg`) is the shared background token for chat transcript surfaces.
- Input/composer token set
  - `--opencode-input-area-bg` controls input container background and user-message background treatment.
  - `--opencode-composer-border` controls input and user-message edge borders.
- Cursor variant overrides
  - `.dark[data-theme-variant="cursor"]`
    - `--opencode-input-area-bg: #212121`
    - `--opencode-composer-border: #737373`
    - `--chat-surface-bg: #181818`
- Nexus variant overrides
  - `.dark[data-theme-variant="nexus"]`
    - `--opencode-input-area-bg: #1d1d1d`
    - `--chat-surface-bg: #0a0a0a`
    - `--workspace-sidebar-bg: #141414`

## 4.6 Node component-local sizing/treatment

- Project group node: `rounded-[22px]`, header `h-[54px]`, min width clamp `320`, min height clamp `300`.
- Context card node: `rounded-[18px]`, node-resizer `minWidth=260`, `minHeight=80`.
- Subproject/fork cards use reusable `GraphNodeTemplate` (`rounded-lg border border-border/80 bg-card/90`).

## 5) Runtime Confirmation (agent-browser)

Verified interactions and geometry in live UI:

- Theme controls are interactive and stateful:
  - Toggle button label flips (`Switch to dark mode` <-> `Switch to light mode`).
  - Variant combobox toggles selected option (`Nexus` / `Maroon` / `Cursor`).
- Runtime layout sample (captured from `.react-flow__node`):
  - `project-shell:cdd-web-ui`: `translate(0px, 996px)` width `380px` height `258px`
  - `project-shell:nexus`: `translate(218px, 0px)` width `380px` height `342px`
  - Sample viewport transform: `translate(26px, 59.9468px) scale(0.432302)`
- Runtime panel geometry sample:
  - Controls panel x/y/size approx `x=695.95`, `y=582`, `28x106`
  - MiniMap approx `202x152`
  - Right sidebar computed width approx `319.047px`
- Runtime typography confirmation:
  - Pre-fix symptom: computed `font-family` showed Tailwind fallback stack (`ui-sans-serif, system-ui, ...`) when only `geistSans.variable` + `font-sans` were present.
  - Current verified state: computed body `font-family` resolves to `Geist, "Geist Fallback"` after adding `geistSans.className` to `<body>`.

## 6) Parameter Dependency Graph (Practical)

- `workspace.theme` + `workspace.theme.variant` -> HTML class/dataset -> CSS variable resolution in `globals.css`.
- Resolved CSS vars (`--color-*`, `--flow-*`, `--md-*`, `--syntax-*`) -> utility classes and React Flow CSS bridge vars (`--xy-*`).
- Layout constants (`GROUP_*`, `PROJECT_*`, `CARD_*`) + Dagre spacing -> generated node coordinates/sizes.
- Interaction constants (`snapGrid`, keyboard steps, zoom bounds) -> movement, fit, and focus behavior.
- Persistent panel/viewport keys (`workspace.chat.*`, `cdd-react-flow-ui/state/v10`) -> restored shell and canvas state.

## 7) Notable Gaps / Consolidation Opportunities

- Canvas background and dot color are hardcoded in two TSX files (`ContextGraphCanvas` and `OpencodeForkGraphCanvas`) in addition to CSS variables; these could be fully token-driven.
- Edge color picker currently always returns `var(--color-edge-blue)` even though green/pink edge palette tokens exist.
- Some node accents use direct utility color classes (`emerald`, `amber`, `white`) rather than semantic CSS variables.
