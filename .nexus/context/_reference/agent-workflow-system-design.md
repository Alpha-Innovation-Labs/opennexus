# Agent & Workflow System Design

> **⚠️ LEGACY**: This design predates the client-server architecture decision. The workflow concepts remain valid but the crate structure and dependency graph are outdated. See `vision.md` for current architecture.

**Date**: 2026-01-06
**Purpose**: Design document capturing the planning conversation for Nexus's agent and workflow system.

## Overview

This document summarizes the design decisions made for implementing a comprehensive agent and workflow system in Nexus (Context-Driven Development). The system enables specialized AI conversations primed with specific tools, system prompts, and preloaded content, orchestrated through workflows for complex multi-step tasks.

## Key Design Decisions

### 1. Separate Crates (Not Subdirectories)

**Decision**: Create two new crates rather than extending nexus-rig with subdirectories.

- `nexus-agents` - Named agent definitions
- `nexus-workflows` - Workflow orchestration

**Rationale**: Clear separation of concerns, independent versioning, cleaner dependency graph.

### 2. Simplified Agent List

**Decision**: 5 agents instead of 8.

| Agent           | Purpose                                      |
| --------------- | -------------------------------------------- |
| Context Manager | Manages `.context/` files                      |
| Developer       | Code tasks (4 modes: build, test, diagnose, fix) |
| Playground      | Experimental work in git worktree            |
| Research        | Parallel web queries (3 phrasings)           |
| Summarizer      | Incremental conversation summaries           |

**Rationale**: Builder, Tester, Bug Report, and QA were merged into Developer with different modes (same tools, different system prompts). Reduces complexity while maintaining functionality.

### 3. Agent Modes vs Separate Agents

**Decision**: Developer agent has 4 modes, each with a different system prompt.

- `build` - Implementing context specifications
- `test` - Running E2E tests
- `diagnose` - Analyzing bugs, creating regression tests
- `fix` - Fixing identified issues

**Rationale**: Same toolset, different behavior. Configured by workflow, not separate agent definitions.

### 4. Workflow System

**Decision**: Build workflows as first-class citizens.

Workflows orchestrate agent chains with:
- Sequential execution
- Conditional branching (on failure)
- Parallel execution (Research)
- Result passing between agents
- Single continuous conversation thread

| Workflow   | Chain                                            |
| ---------- | ------------------------------------------------ |
| Bug Fix    | Developer(diagnose) → Developer(fix) → Context Manager |
| Build      | Developer(build) → Developer(test) → [if fail] Developer(fix) |
| Test       | Developer(test) → [if fail] Developer(fix)       |
| Playground | Playground → Context Manager                     |
| Research   | [3x Research parallel] → Summarizer              |

### 5. UI Organization

**Decision**: Flat menu bar, individual context files per view.

Menu: `[Home | Context | Bug Report | Build | Test | Playground | Research | Summaries | Settings]`

**Rationale**: Each view has distinct functionality. Grouping deferred until UI is visible.

### 6. Settings Persistence

**Decision**: Settings stored at `~/.config/nexus/settings.json`.

Sections:
- `hotkeys` - Customizable keybindings
- `playground` - Worktree location, auto-cleanup
- `summarizer` - Auto timeout, enabled toggle
- `research` - Query confirmation toggle
- `general` - Theme

### 7. Playground Uses Git Worktree

**Decision**: Playground creates actual `git worktree`, not just a temp directory.

**Rationale**: Proper isolation, can commit experimental changes, integrates with git workflow.

### 8. Research Uses 3 Query Phrasings

**Decision**: Research agent generates 3 different phrasings of the user's query.

**Rationale**: Increases breadth of search results. Different angles surface different information.

### 9. Waterfall Approach

**Decision**: Complete specification before implementation.

All context files created upfront defining the full system. No incremental/agile delivery.

## Created Artifacts

### New Projects

| Project       | Prefix | Files |
| ------------- | ------ | ----- |
| nexus-agents    | AGT    | 6 + index |
| nexus-workflows | WKF    | 6 + index |

### Updated Projects

| Project | New Files |
| ------- | --------- |
| nexus     | NEXUS_009 (settings) |
| nexus-rig | RIG_012, RIG_013 |

### Total New Context Files: 26

## Dependency Graph

```
nexus (settings persistence)
    ↓
nexus-rig (parallel execution, preloaded content)
    ↓
nexus-agents (agent definitions)
    ↓
nexus-workflows (workflow orchestration)
```

## Open Items for Future

1. **Workflow Editor** - Visual editing of workflow definitions (mentioned but deferred)
2. **Menu Grouping** - May reorganize flat menu once visible
3. **Pro Features** - Some features may become paid
4. **Knowledge Harvester Integration** - Summarizer could integrate with knowledge extraction (explicitly deferred)

## Files Created

```
.context/
├── vision.md                              # System architecture overview
├── _reference/
│   └── agent-workflow-system-design.md    # This file
├── nexus-agents/
│   ├── index.md
│   ├── AGT_001-agent-definition-framework.md
│   ├── AGT_002-context-manager-agent.md
│   ├── AGT_003-developer-agent.md
│   ├── AGT_004-playground-agent.md
│   ├── AGT_005-research-agent.md
│   └── AGT_006-summarizer-agent.md
├── nexus-workflows/
│   ├── index.md
│   ├── WKF_001-workflow-orchestration-framework.md
│   └── WKF_006-research-workflow.md
├── nexus/
│   └── NEXUS_009-settings-persistence.md
├── nexus-rig/
│   ├── RIG_012-parallel-agent-execution.md
│   └── RIG_013-preloaded-content.md
```
