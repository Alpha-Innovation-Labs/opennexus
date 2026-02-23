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

CDD in Nexus is anchored by harness source files:

- `.nexus/ai_harness/skills/context-driven-development/SKILL.md`: the canonical CDD specification. It defines context purpose, naming, required frontmatter, required sections, E2E testability rules, anti-patterns, and project/feature index expectations.
- `.nexus/ai_harness/commands/nexus-context-create.md`: the workflow spec for creating context files from user goals.
- `.nexus/ai_harness/commands/nexus-context-update.md`: the workflow spec for updating existing context and index docs.
- `.nexus/ai_harness/commands/nexus-context-sync.md`: the analysis-only workflow for proposing context/index updates from conversation evidence.

Together they enforce the core split in CDD: `PRJ_NNN-*.md` files specify outcomes, while `index.md` documents how to operate the project.

## Harness Behavior

`/nexus-context-create` follows the context skill and applies a fixed workflow:

- scan `.nexus/context/` for overlap before creating new context files,
- confirm whether to update existing context files or create new ones,
- split user goals into multiple context files when outcomes are distinct,
- assign the next project-scoped context ID across all feature folders,
- create missing project/feature `index.md` files when a new directory is introduced.

## Context Structure

Contexts live under `.nexus/context/<project>/<feature>/` and follow strict naming and format conventions.

Example:

```text
.nexus/context/
  <project>/
    index.md
    <feature>/
      index.md
      PRJ_001-short-description.md
      PRJ_002-another-outcome.md
    _reference/
```

- `PRJ_NNN-*.md` files are outcome specifications and belong to a feature folder.
- project `index.md` stores project-level operational knowledge.
- feature `index.md` stores feature-level operational knowledge.
- `_reference/` stores background research/design material.

## What Goes in a Context File

Each numbered context includes:

- YAML frontmatter (`context_id`, `title`, `project`, `feature`, `created`)
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

The `opennexus` CLI operationalizes CDD standards in repositories by installing and maintaining the project assets and conventions that support context-driven work.

## Install and Use

### Install

OpenNexus is published through multiple package ecosystems.

| Ecosystem | Install Command |
|-----------|------------------|
| Cargo (crates.io) | `cargo install opennexus --bin opennexus` |
| npm | `npm install -g opennexus` |
| uv / PyPI | `uv tool install opennexus` |
| Homebrew | `brew tap Alpha-Innovation-Labs/tap && brew install opennexus` |
| Scoop | `scoop bucket add alpha-innovation-labs https://github.com/Alpha-Innovation-Labs/scoop-bucket && scoop install opennexus` |
| AUR | In progress (not published yet) |

If you are contributing from source, use the local install recipe:

```bash
just install
```

This installs `opennexus` globally from the current source checkout (`cargo install --path . --bin opennexus --force`).

### Use

```bash
# Show commands
opennexus --help

# Prepare current project with Nexus assets
opennexus setup

# Prepare current project with an explicit harness
opennexus setup --harness opencode

# Search marketplace packages
opennexus marketplace search "fumadocs"

# Install a package from marketplace registry
opennexus marketplace install fumadocs

# Install directly from a GitHub repository package
opennexus marketplace install github.com/<owner>/<repo>

# Update installed CLI
opennexus update

# Remove installed CLI
opennexus uninstall
```

You can also run setup without global install while developing locally:

```bash
just setup
```

## What `opennexus setup` Prepares

`opennexus setup` extracts and wires the Nexus project assets so a repository is ready for context-driven development.

It also writes `.nexus/config.json` with the selected harness (`opencode` by default), current CLI version (`opennexus --version`), and docs-sync state.

```text
.
├── .nexus/
│   ├── ai_harness/
│   │   ├── commands/
│   │   │   ├── nexus-context-create.md
│   │   │   ├── nexus-context-sync.md
│   │   │   ├── nexus-context-review.md
│   │   │   └── ...
│   │   ├── skills/
│   │   │   ├── context-driven-development/
│   │   │   ├── opencode-rs-sdk/
│   │   │   └── ratkit/
│   │   ├── rules/
│   │   │   └── ...
│   ├── context/
│   │   ├── nexus/
│   │   ├── nexus-cli/
│   │   └── ... (installed via marketplace)
├── .nexus/config.json          # Harness + docs sync state
└── .opencode/                  # Created when harness=opencode
    ├── command/
    │   ├── nexus-context-create.md -> ../../.nexus/ai_harness/commands/nexus-context-create.md
    │   ├── nexus-context-sync.md -> ../../.nexus/ai_harness/commands/nexus-context-sync.md
    │   ├── nexus-context-review.md -> ../../.nexus/ai_harness/commands/nexus-context-review.md
    │   └── ...
    ├── skills/
    │   ├── context-driven-development/ -> ../../.nexus/ai_harness/skills/context-driven-development
    │   ├── opencode-rs-sdk/ -> ../../.nexus/ai_harness/skills/opencode-rs-sdk
    │   └── ...
    └── rules/
        ├── rust/ -> ../../.nexus/ai_harness/rules/rust
        ├── python/ -> ../../.nexus/ai_harness/rules/python
        └── ...
```

When harness is `opencode`, `opennexus setup` also removes stale generated entries under `.opencode/command`, `.opencode/skills`, and `.opencode/rules` before recreating links, and removes the legacy `.nexus/rules` directory.

Important: `.nexus/**` is the source of truth. `.opencode/**` entries are generated linkage created by setup.

For authoritative CDD rules, see `.nexus/ai_harness/skills/context-driven-development/SKILL.md`.
