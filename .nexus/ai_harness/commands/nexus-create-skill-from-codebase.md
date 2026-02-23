---
description: Orchestrates subagents to generate a project skill file from the codebase
---

You are the primary execution agent for this command and you must orchestrate the workflow yourself.

Your job is to generate one high-quality skill document for this repository and store it at:
- `.nexus/ai_harness/skills/<project-name>/SKILL.md`

You must also write generation state to:
- `.nexus/ai_harness/skills/<project-name>/skills-state.json`

## Core Behavior

1. Determine the project name first (required).
2. Confirm the detected project name with the user using the `question` tool.
3. Determine generation mode (`full` or `incremental`) using per-project state.
4. Spawn domain subagents.
5. Merge subagent outputs into one coherent `SKILL.md`.
6. Validate and write final outputs.

Do not spawn a separate orchestration agent. You (the command agent) perform orchestration directly.

## Project Name Resolution (mandatory)

Before any generation work:

1. Try to detect project name in this order:
   - `Cargo.toml` (`[package].name`)
   - `package.json` (`name`)
   - `pyproject.toml` (`project.name`)
2. If detected, ask user to confirm via `question` tool.
3. If not detected, ask user for project name via `question` tool.
4. If user corrects name, use user-provided value.
5. Normalize final folder name to kebab-case for `<project-name>` path segment.

Question rules:
- Recommended option must be first and include `(Recommended)`.
- If detection succeeded, offer at least:
  - `Use detected name (Recommended)`
  - `Provide different name`
- If detection failed, ask for free-form input.

## Objective

Produce `SKILL.md` that helps coding agents:
- understand architecture and boundaries quickly
- find the correct crate/module/docs for a task
- follow repository conventions and constraints
- avoid common implementation mistakes
- generate compile-ready, style-consistent changes

## Non-Negotiable Constraints

1. Generate exactly one skill artifact: `SKILL.md`.
2. State file must be per-project and named `skills-state.json`.
3. Use verified facts only; do not invent paths, commands, features, or conventions.
4. Verify referenced links/paths exist before including them.
5. Keep writing concise, technical, and instruction-first.
6. Use committed history only as input for generation decisions.
7. Never use unstaged, staged-but-uncommitted, or untracked working-tree changes to drive updates.

## Mode and State

State file path:
- `.nexus/ai_harness/skills/<project-name>/skills-state.json`

State schema:

```json
{
  "skill_path": ".nexus/ai_harness/skills/<project-name>/SKILL.md",
  "last_generated_commit": "<sha>",
  "generated_at": "<ISO-8601>"
}
```

Mode selection:
- Run `git status --porcelain` first.
- If working tree is dirty, stop with a blocking message.
- If `SKILL.md` or `skills-state.json` is missing -> `full` mode.
- If both exist -> `incremental` mode using `last_generated_commit..HEAD`.
- Incremental mode must use committed history only.

## Orchestration Workflow

Before spawning subagents, read and enforce:
- `.nexus/ai_harness/skills/skill-from-codebase/SKILL.md` as generation/validation baseline for quality
- adapt output target to `SKILL.md` format and project-skill purpose

### Phase 1A: Full mode scan and planning

- Scan repository tree and identify major knowledge domains.
- Infer decomposition from repository structure (do not hardcode categories).
- Choose minimal useful number of subagents.
- Produce short internal plan:
  - chosen domain split
  - why split is appropriate
  - subagent assignments

### Phase 1B: Incremental mode impact analysis

- Compute changed files since `last_generated_commit`.
- Include add/edit/rename/delete in impact analysis.
- Map changed paths to impacted skill sections.
- Escalate to full mode if changes are broad or structural.

### Phase 2: Domain subagents

For each domain/impact area, spawn a subagent.

Each subagent must:
- read only relevant files plus shared root context
- return domain material for `SKILL.md`
- include:
  - actionable rules/constraints
  - common pitfalls
  - key links/paths with one-line usage notes
  - any uncertainties needing orchestrator resolution
- not write files directly

### Phase 3: Assembly subagent

Spawn one dedicated assembly subagent and provide:
- all domain outputs
- mode context (`full` or `incremental`)
- current `SKILL.md` content (incremental mode)
- required output shape and constraints
- instruction to verify version from real manifest (`Cargo.toml`, `package.json`, or `pyproject.toml`)

Assembly responsibilities:
- full mode: build unified `SKILL.md`
- incremental mode: update only impacted sections, preserve untouched sections
- remove overlap, contradictions, and unverifiable claims
- return final proposed `SKILL.md` content + short change summary

### Phase 4: Validator subagent

Spawn one dedicated validator subagent with:
- proposed `SKILL.md`
- repository state and relevant source files
- constraints from this command

Validator responsibilities:
- verify quality and factual correctness
- verify links/paths exist
- verify version string matches manifest
- verify incremental scope discipline unless full escalation occurred
- return pass/fail + concrete fixes

If fail:
- iterate assembly + validator until pass

## Required `SKILL.md` Shape

Use this section order:

`# <Project Name> Skill`

`> 1-2 sentence operational summary for coding agents.`

One short paragraph describing how agents should use this skill.

`## Agent Operating Rules`
`## Environment and Version Constraints`
`## Quick Task Playbooks`
`## Workspace Overview`
`## Domain Guides`
`## API/Interface Reference`
`## Common Pitfalls`
`## Validation Checklist`

For link-heavy sections, use:
- `[Title](path-or-url)`: what it contains + when to use

## Quality Gate (must pass before writing)

- exactly one H1 at top
- no broken internal links
- no duplicate entries
- no nonexistent files/directories
- no unverifiable claims
- no generic filler text
- version string matches manifest file
- incremental update changed only impacted sections unless escalated
- input came from committed history only

## Finalization

1. Write final content to `.nexus/ai_harness/skills/<project-name>/SKILL.md` only after validator pass.
2. Write/update `.nexus/ai_harness/skills/<project-name>/skills-state.json` with current `HEAD` as `last_generated_commit` only after successful write.
3. Return completion note including:
   - resolved project name
   - mode used (`full` or `incremental`)
   - clean working tree status
   - baseline commit and current commit
   - changed files considered (incremental)
   - detected domain split
   - number of subagents used
   - validations performed

After presenting the result, use the `reporting` tool with:
- input: the final completion note
- sound: /System/Library/Sounds/Glass.aiff
- notificationTitle: "Skill Generate"
- notificationBody: first lines of the completion note
