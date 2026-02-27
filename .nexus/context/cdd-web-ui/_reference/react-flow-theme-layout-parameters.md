# React Flow UI Theme and Layout Parameter Inventory

Last updated: 2026-02-27
Scope: `apps/react-flow`

## Investigation Method

This inventory combines:

1. Static code inspection across `apps/react-flow/src/**` (CSS variables, React Flow config, node sizing/layout constants, shell sizing).
2. Runtime verification with `agent-browser` on `http://localhost:4174/context`:
   - Theme mode toggle and theme variant selector behavior.
   - Computed CSS variable values (`agent-browser eval` with `getComputedStyle`).
   - Runtime canvas/node positioning and panel geometry.

## 1) Theme Variable Sources (Authoritative Files)

- Global design tokens and React Flow variable bridge: `apps/react-flow/src/styles/globals.css`
- Theme mode/variant persistence and DOM wiring: `apps/react-flow/src/features/workspace-shell/components/workspace-shell-layout.tsx`
- Theme controls UI: `apps/react-flow/src/features/workspace-shell/components/workspace-top-nav.tsx`
- Runtime theme observer hook: `apps/react-flow/src/shared/hooks/use-theme-mode.ts`
- Context graph canvas color fallback + viewport behavior: `apps/react-flow/src/features/context-graph/components/context-graph-canvas.tsx`
- Fork graph canvas color fallback + viewport behavior: `apps/react-flow/src/features/opencode-panel/components/opencode-fork-graph-canvas.tsx`
- Markdown/syntax theme usage in OpenCode panel: `apps/react-flow/src/features/opencode-panel/components/opencode-conversation-panel.tsx`

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

### 2.2 Theme-scope utility variables (`:root`, `.dark`, `.dark[data-theme-variant="tui"]`)

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
- Theme variant (`current`/`tui`) is persisted in local storage key `workspace.theme.variant` and applied as `document.documentElement.dataset.themeVariant`.

### 3.2 Runtime-verified computed values (agent-browser)

Observed with `agent-browser eval`:

- Dark + `current`
  - `--color-background`: `#151313`
  - `--color-foreground`: `#f6f3f3`
  - `--flow-canvas-bg`: `#1a1717`
  - `--subflow-bg`: `#231f1f`
  - `--color-edge-blue`: `#93e9f6`
  - `--flow-edge`: `#93e9f6`
  - `--xy-background-color-default`: `#1a1717`
- Dark + `tui`
  - `--color-background`: `#0a0a0a`
  - `--color-secondary`: `#5c9cf5`
  - `--color-accent`: `#9d7cd8`
  - `--flow-canvas-bg`: `#141414`
  - `--subflow-bg`: `#1e1e1e`
  - Edge palette: `#5c9cf5`, `#7fd88f`, `#9d7cd8`
- Light + `tui` selected (variant retained, no `.dark` class)
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
- Right chat panel persistence
  - Local storage keys: `workspace.chat.size`, `workspace.chat.collapsed`
  - Default size fallback: `32%`
  - Resizable split defaults: `${100 - initialChatPanelSize}%` and `${initialChatPanelSize}%`
- Right sidebar render
  - Border/background: `border-l border-border/70 bg-card/55`

## 4.6 Node component-local sizing/treatment

- Project group node: `rounded-[22px]`, header `h-[54px]`, min width clamp `320`, min height clamp `300`.
- Context card node: `rounded-[18px]`, node-resizer `minWidth=260`, `minHeight=80`.
- Subproject/fork cards use reusable `GraphNodeTemplate` (`rounded-lg border border-border/80 bg-card/90`).

## 5) Runtime Confirmation (agent-browser)

Verified interactions and geometry in live UI:

- Theme controls are interactive and stateful:
  - Toggle button label flips (`Switch to dark mode` <-> `Switch to light mode`).
  - Variant combobox toggles selected option (`Current Theme` / `TUI Theme`).
- Runtime layout sample (captured from `.react-flow__node`):
  - `project-shell:cdd-web-ui`: `translate(0px, 996px)` width `380px` height `258px`
  - `project-shell:nexus`: `translate(218px, 0px)` width `380px` height `342px`
  - Sample viewport transform: `translate(26px, 59.9468px) scale(0.432302)`
- Runtime panel geometry sample:
  - Controls panel x/y/size approx `x=695.95`, `y=582`, `28x106`
  - MiniMap approx `202x152`
  - Right sidebar computed width approx `319.047px`

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
