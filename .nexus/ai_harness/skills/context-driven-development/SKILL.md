---
name: context-driven-development
description: Use this skill for all context planning, creation, updates, review, search, and sync work in this repository.
compatibility: opencode
---

# Context-Driven Development (CDD)

This is the single source of truth for CDD in this repository.

## Purpose

CDD separates:
- Context specifications (`PRJ_NNN-*.md`): define desired outcomes and E2E-observable next actions.
- Operational knowledge (`index.md`): document how projects/features work and how to operate/debug them.

Use CDD to describe what success looks like, not how code should be implemented.

## Canonical Structure

```text
.nexus/context/<project>/
├── index.md                    # Project operational knowledge
├── <feature>/
│   ├── index.md                # Feature operational knowledge
│   └── PRJ_NNN-*.md            # Context specifications
└── _reference/                 # Optional reference docs (research/design/notes)
```

Mapping:
- `<project>`: crate/package/system name (kebab-case)
- `<feature>`: feature/domain name (kebab-case)

Rules:
- Every context file must live under `.nexus/context/<project>/<feature>/`.
- Context IDs are project-scoped and increment across all features in a project.

## Context File Naming

- Pattern: `PRJ_NNN-brief-description.md`
- `PRJ`: 3-letter uppercase project prefix
- `NNN`: zero-padded number shared across project features
- `brief-description`: kebab-case, concise

Examples:
- `CLI_007-marketplace-search.md`
- `KNO_012-sync-workflow.md`

## Context Frontmatter

Required YAML fields:

```yaml
---
context_id: PRJ_001
title: Human-Readable Title
project: project-name
feature: feature-name
created: "YYYY-MM-DD"
---
```

## Context Required Sections

Context specs must use this order:

1. `# PRJ_NNN: Title`
2. `## Desired Outcome`
3. `## Reference` (optional; remove when empty)
4. `## Next Actions`

### Desired Outcome

- One outcome per context.
- One concise paragraph describing the end state.
- No implementation details.

### Reference

- Optional and visual-first.
- Include diagrams, tables, links, constants.
- Remove this section if empty.

### Next Actions

Use a table:

| Description | Test |
|-------------|------|
| ... | `...` |

Rules:
- `Description`: starts with an action verb.
- `Test`: snake_case, no `test_` prefix.
- Every row must be E2E-observable and black-box verifiable.
- Focus on user-visible behavior, error handling, and edge cases.

## Project and Feature `index.md`

`index.md` files store operational knowledge, not context specs.

Project `index.md` should include:
- Overview
- Features table
- Architecture (ASCII diagram)
- CLI Usage
- Key Dependencies
- Environment Variables
- Debugging & Troubleshooting

Feature `index.md` should include:
- Scope
- Context Files
- Interfaces
- Dependencies
- Troubleshooting

## CDD Principles

1. One outcome per context file.
2. Keep contexts small and clear; split when outcomes diverge.
3. Describe what and observable results, not internal implementation.
4. Keep project/feature operational docs current when behavior changes.
5. Reuse and update existing contexts before creating new ones when possible.

## Anti-Patterns

Do not put these in numbered context specs:
- Code snippets or pseudocode
- Internal implementation plans
- Unit/integration-only assertions
- CI/CD boilerplate unless the outcome is CI/CD itself
- Multiple unrelated outcomes in one file

## Command Map

- `nexus` -> select context
- `/nexus-context-create` -> create context specs
- `/nexus-context-update` -> update context/index docs
- `/nexus-context-sync` -> propose updates from conversation
- `/nexus-context-review` -> audit CDD compliance
- `/nexus-context-search` -> search contexts by outcome/actions
- `/nexus-context-from-code` -> recommend contexts from code scope

## Enforcement

When working on any context command or context file:
- Read and apply this skill first.
- Treat this file as authoritative if conflicts exist elsewhere.
