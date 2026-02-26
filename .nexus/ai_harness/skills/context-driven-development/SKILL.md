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
- Project wrapper skills (`skill/SKILL.md`, optional): document how a project should be consumed by other projects.

CDD also supports explicit blocking dependencies between contexts.

Use CDD to describe what success looks like, not how code should be implemented.

## Canonical Structure

```text
.nexus/context/<project>/
├── index.md                    # Project operational knowledge
├── skill/
│   └── SKILL.md                # Optional cross-project wrapper/integration contract
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
- Optional project wrapper skills live under `.nexus/context/<project>/skill/SKILL.md`.
- Context IDs use a 3-letter prefix from either the **project** or the **feature**.
- Choose one approach per project and be consistent.
- If using feature-scoped prefixes, each feature/subfeature must have a unique 3-letter prefix.

## Project Wrapper Skill (Optional)

Use `.nexus/context/<project>/skill/SKILL.md` when a project is intended to be wrapped or reused by other projects.

Purpose:
- Define how other projects should call, query, and integrate with the wrapped project.
- Provide stable integration guidance without turning context specs into implementation docs.

Rules:
- Treat wrapper skill guidance as integration contract documentation, not execution state.
- Keep blocking sequencing in context frontmatter (`depends_on.contexts`), not in wrapper skill prose.
- Keep wrapper guidance focused on cross-project usage surfaces (APIs, commands, expected inputs/outputs, guardrails).

## Context File Naming

- Pattern: `PRJ_NNN-brief-description.md` or `FTR_NNN-brief-description.md`
- `PRJ` or `FTR`: 3-letter uppercase prefix from **project** or **feature** name
- `NNN`: zero-padded sequence number (scoped to the chosen prefix)
- `brief-description`: kebab-case, concise
- For each unique prefix, numbering starts at `001` and increments within that prefix only.

Prefix choice:
- **Project-scoped** (e.g., `CLI_001`, `CLI_002`): Use when contexts span multiple features
- **Feature-scoped** (e.g., `RAL_001`, `MKT_002`): Use when each feature has independent context tracking

Examples:
- `CLI_007-marketplace-search.md` (project-scoped)
- `RAL_001-ralph-command-surface.md` (feature-scoped)
- `KNO_012-sync-workflow.md` (project-scoped)

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

Optional dependency metadata (blocking prerequisites only):

```yaml
depends_on:
  contexts:
    - id: ABC_001
      why: Requires upstream contract and CLI behavior to be finalized.
    - id: XYZ_014
      why: Reuses auth flow acceptance criteria.
```

Rules:
- `depends_on` is optional; omit when there are no prerequisites.
- Declare dependencies in `depends_on.contexts` only.
- Every listed dependency is blocking: it must be completed before this context can proceed.
- Each `depends_on.contexts` entry must be an object with:
  - `id`: context ID (for example `ABC_001`)
  - `why`: short reason for the dependency (max 140 characters)
- Keep dependencies minimal and direct; do not duplicate transitive prerequisites.

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

## Dependency Semantics

Dependencies are strict prerequisites, not suggestions.

- Context dependency: this context is blocked until the referenced context is complete.
- Dependencies must be declared only in context frontmatter under `depends_on.contexts`.
- Context files must never depend on project names; context dependencies are context-to-context only.
- If dependencies are unknown or not verifiable, stop and ask for clarification before implementation.
- Keep dependency declarations minimal and explicit; do not list non-blocking or transitive relationships.

## Project and Feature `index.md`

`index.md` files store operational knowledge, not context specs.

Both project and feature `index.md` files must start with YAML frontmatter using this exact schema:

```yaml
---
project_id: project-or-subproject-id
title: Human-Readable Title
created: "YYYY-MM-DD"
status: active
dependencies:
  - other-project-id
---
```

Rules for index frontmatter and dependency content:
- Use the same exact frontmatter keys for project and feature indexes.
- `dependencies` entries must be project identifiers only.
- Do not list apps, libraries, frameworks, crates, or tools as dependencies.

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

Rules:
- Project dependencies are project-to-project documentation in `index.md` files only.
- `index.md` dependency sections are informational only.
- Do not use project/feature `index.md` as the authoritative source for blocking context dependencies.
- Canonical blocking dependency data lives in context frontmatter `depends_on.contexts`.

## CDD Principles

1. One outcome per context file.
2. Keep contexts small and clear; split when outcomes diverge.
3. Describe what and observable results, not internal implementation.
4. Keep project/feature operational docs current when behavior changes.
5. Reuse and update existing contexts before creating new ones when possible.
6. Declare blocking dependencies explicitly whenever sequencing matters.

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
- `/nexus-context-generate-red-tests` -> generate red-only tests from `Next Actions`
- `/nexus-context-sync-from-chat` -> propose updates from conversation
- `/nexus-context-sync-with-code` -> propose updates from git/code changes
- `/nexus-context-review` -> audit CDD compliance
- `/nexus-context-search` -> search contexts by outcome/actions
- `/nexus-context-from-code` -> recommend contexts from code scope
- `/nexus-context-validate-unstaged` -> validate unstaged code/tests against Next Actions and language rules

## Enforcement

When working on any context command or context file:
- Read and apply this skill first.
- Treat this file as authoritative if conflicts exist elsewhere.
