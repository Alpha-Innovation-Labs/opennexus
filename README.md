# Nexus

Nexus is a CLI and project standard for **Context-Driven Development (CDD)**.

CDD organizes software work around clear, outcome-first context files instead of ad hoc task notes or implementation-first tickets.

## What CDD Means

In CDD, each context is a small specification that answers:

- What outcome do we want?
- What observable behaviors prove it is done?

The implementation details stay in code and engineering decisions. The context stays focused on intent, scope, and verifiable completion.

## Core CDD Principles

- One context = one desired outcome.
- Define next actions as concrete, black-box testable behaviors.
- Describe **what** to build, not **how** to build it.
- Keep contexts small; split when complexity grows.
- Separate specification from operational knowledge.

## CDD Source Files

CDD in Nexus is anchored by two key files:

- `.nexus/rules/context.md`: the canonical CDD specification. It defines context purpose, naming, required frontmatter, required sections, E2E testability rules, anti-patterns, and how numbered context files differ from project knowledge.
- `.nexus/templates/PROJECT.md`: the template for `.context/<project>/index.md`. It defines the operational knowledge format for a project (overview, architecture, CLI usage, dependencies, environment variables, troubleshooting) and keeps that documentation separate from numbered context specs.

Together they enforce the core split in CDD: `PRJ_NNN-*.md` files specify outcomes, while `index.md` documents how to operate the project.

## Context Structure

Contexts live under `.context/<project>/` and follow strict naming and format conventions.

Example:

```text
.context/
  <project>/
    index.md
    PRJ_001-short-description.md
    PRJ_002-another-outcome.md
    _reference/
```

- `PRJ_NNN-*.md` files are the outcome specifications.
- `index.md` is project operational knowledge (architecture, usage, troubleshooting), not a numbered context.
- `_reference/` stores background research/design material.

## What Goes in a Context File

Each numbered context includes:

- YAML frontmatter (`context_id`, `title`, `project`, `created`)
- `Desired Outcome` section (end-state only)
- optional `Reference` section (diagrams/links)
- `Next Actions` table with:
  - human-readable behavior descriptions
  - snake_case test names representing E2E validation

The testability rule is simple: every action must be verifiable through public behavior (CLI output, filesystem effects, logs, network responses), not internal state.

## Why Teams Use CDD

CDD improves delivery quality by making work:

- easier to scope and review,
- clearer to hand off across contributors,
- more consistent across projects,
- directly tied to observable acceptance criteria.

## Nexus Role

The `nexus` CLI operationalizes CDD standards in repositories by installing and maintaining the project assets and conventions that support context-driven work.

## Install and Use

### Install

```bash
just install
```

This installs `nexus` globally from the current source checkout (`cargo install --path . --force`).

### Use

```bash
# Show commands
nexus --help

# Prepare current project with Nexus assets
nexus setup

# Update installed CLI
nexus update

# Remove installed CLI
nexus uninstall
```

You can also run setup without global install while developing locally:

```bash
just setup
```

## What `nexus setup` Prepares

`nexus setup` extracts and wires the Nexus project assets so a repository is ready for context-driven development.

```text
.
├── .nexus/
│   ├── .version
│   ├── commands/
│   │   ├── nexus-0-prompt.md
│   │   ├── nexus-1.2-context-create.md
│   │   └── ...
│   ├── context/
│   │   ├── .extract-allowlist
│   │   ├── nexus/
│   │   ├── nexus-cli/
│   │   └── fumadocs/
│   ├── rules/
│   │   ├── context.md
│   │   ├── rs.md
│   │   └── ...
│   └── templates/
│       ├── PROJECT.md
│       ├── AGENTS.md
│       └── nexus/
└── .opencode/
    └── command/
        ├── nexus-0-prompt.md -> ../../.nexus/commands/nexus-0-prompt.md
        ├── nexus-1.2-context-create.md -> ../../.nexus/commands/nexus-1.2-context-create.md
        └── ...
```

Important: `.nexus/**` is the source of truth. `.opencode/command/**` is generated linkage created by setup.

For authoritative rules, see `.nexus/rules/context.md`.
