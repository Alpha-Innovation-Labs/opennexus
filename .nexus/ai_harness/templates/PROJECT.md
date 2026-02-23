---
project_id: project-name
title: Project Title
created: "YYYY-MM-DD"
status: active  # active, complete, on-hold
dependencies: []  # List of project_ids this depends on
---

<!--
SOURCE OF TRUTH: .nexus/ai_harness/skills/context/SKILL.md

PROJECT INDEX: .nexus/context/<project-name>/index.md
This file provides operational knowledge for a project (crate, package, module).

FEATURE-FIRST STRUCTURE:
.nexus/context/<project-name>/
├── index.md                      # This file (project overview + operational knowledge)
├── <feature>/
│   ├── index.md                  # Feature operational knowledge
│   └── PRJ_NNN-*.md              # Context specifications for that feature
└── _reference/                   # Optional project-level reference docs

CRITICAL RULES:
- NO code - operational tips only
- Focus on WHAT the project does and HOW to use it
- Include architecture diagrams, CLI usage, debugging guides
- Keep dependencies accurate for build ordering
- Keep features explicit and stable (kebab-case feature names)
-->

# Project Title

## Overview

<!-- What does this project do? Who uses it? What problem does it solve? -->

<One paragraph describing the project's purpose and users.>

## Features

<!-- Feature registry for this project. Add one row per feature area. -->

| Feature | Path | Purpose |
|---------|------|---------|
| `core` | `.nexus/context/<project-name>/core/` | Shared project-level behavior and cross-feature flows |
| `example-feature` | `.nexus/context/<project-name>/example-feature/` | Feature-specific contexts and operational notes |

## Architecture

<!-- ASCII diagram showing components and data flow -->

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Project Name                                │
├─────────────────────────────────────────────────────────────────────┤
│  Component A  ──>  Component B  ──>  Component C                    │
└─────────────────────────────────────────────────────────────────────┘
```

## CLI Usage

<!-- How do users interact with this project? -->

```bash
# Example commands
command subcommand [options]
```

## Key Dependencies

<!-- External crates/packages this project relies on -->

| Crate/Package | Purpose |
|---------------|---------|
| example       | Description of why it's used |

## Environment Variables

<!-- Configuration via environment -->

| Variable | Default | Description |
|----------|---------|-------------|
| `EXAMPLE_VAR` | `default` | What it controls |

## Debugging & Troubleshooting

### Common Issue

- Symptom: What the user sees
- Cause: Why it happens
- Fix: How to resolve it
