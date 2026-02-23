# Nexus System

Context-Driven Development uses a feature-first structure under `.nexus/context/`.

## Structure
```
.nexus/context/<project>/
├── index.md                    # Project operational knowledge
├── <feature>/
│   ├── index.md                # Feature operational knowledge
│   └── PRJ_NNN-*.md            # Context specifications
└── _reference/                 # Optional reference documents
```

Folder mapping:
- `<project>` = crate/package/system name (e.g., `nexus-cli`)
- `<feature>` = feature/domain in kebab-case (e.g., `marketplace`, `context-management`)

## Commands
- `nexus` -> Select context (fuzzy finder)
- `/nexus-context-create` -> Create context file(s)
- `/nexus-context-sync` -> Sync context updates from work
- `/nexus-context-review` -> Audit context quality and coverage

## Context Format
```yaml
---
context_id: PRJ_001
title: Human-Readable Title
project: project-name
feature: feature-name
created: "YYYY-MM-DD"
---
```

Required sections:
- `## Desired Outcome`
- `## Reference` (optional; remove if empty)
- `## Next Actions` (table with Description and Test columns)

## Principles
- Contexts are specifications: describe outcomes, not implementation details.
- Project `index.md` and feature `index.md` store operational knowledge.
- Use one outcome per context and keep Next Actions E2E-observable.
- Context IDs are project-scoped and increment across all features.
