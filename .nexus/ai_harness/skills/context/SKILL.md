---
name: context
description: This skill should be used every time you work on context files, context planning, or context updates in this repository.
compatibility: opencode
---

# Context File Standards

## Purpose

A context file defines a **desired outcome** and the **next actions** required to achieve it. This follows GTD principles: the context is the project (desired outcome), and goals are the next actions (concrete steps to completion).

Context files document **what to build**, not how. They are specifications that guide implementation without prescribing exact code.

## Core Principles

1. **One outcome** - Each context file represents one desired outcome. Multiple outcomes require multiple contexts.
2. **Next actions** - Goals are the concrete, actionable steps needed to achieve the outcome.
3. **Simplicity** - Keep it short. If it feels complex, split it.

## Directory Structure

1. **`.nexus/context/` directory at project root** - All context files live here.
2. **Project subdirectories** - Group by project/crate: `.nexus/context/knowledge-harvester/`, `.nexus/context/nexus-cli/`.
3. **Feature subdirectories inside each project** - Group by feature/domain: `.nexus/context/nexus-cli/marketplace/`, `.nexus/context/nexus-cli/core/`.
4. **`index.md` in each project and feature directory** - Operational knowledge, architecture overview, debugging guides.
5. **`_reference/` subdirectory (optional)** - Background plans, design documents, research (not implementation specs).

## Feature Rules

6. **Feature names use kebab-case** - e.g., `marketplace`, `context-management`, `project-setup`.
7. **Every context must belong to a feature** - Context files live under `.nexus/context/<project>/<feature>/`.
8. **Context IDs remain project-scoped** - Numbering continues across all features in the same project (e.g., `CLI_007`, `CLI_008`).

## File Naming

9. **Context files use pattern `PRJ_NNN-brief-description.md`** - Project prefix + zero-padded sequence number + kebab-case description.
10. **Project prefix is 3 uppercase letters** - Abbreviation of project name (e.g., `KNO` for knowledge-harvester, `COR` for context-core).
11. **Sequence numbers are per-project** - Numbering is shared across all feature folders in a project.
12. **Description is 2-4 words** - `CLI_007-marketplace-search.md`, `KNO_007-e2e-tests.md`.

## Project Prefix Examples

| Project | Prefix | Example File |
|---------|--------|--------------|
| knowledge-harvester | KNO | `KNO_001-project-scaffold.md` |
| context-core | COR | `COR_001-opencode-model-detection.md` |
| auth-service | AUT | `AUT_001-oauth-integration.md` |
| pulse-email | EML | `EML_001-imap-sync.md` |

## Example Structure

```
.nexus/context/
├── nexus-cli/
│   ├── index.md
│   ├── core/
│   │   ├── index.md
│   │   ├── CLI_001-baseline-cli.md
│   │   └── CLI_003-clap-migration.md
│   ├── marketplace/
│   │   ├── index.md
│   │   ├── CLI_007-marketplace-search.md
│   │   └── CLI_008-marketplace-install.md
│   └── _reference/
└── .version
```

# Context File Format

## Required Frontmatter

13. **YAML frontmatter is required** with these fields:

```yaml
---
context_id: KNO_001
title: Human-Readable Title
project: knowledge-harvester
feature: core
created: "YYYY-MM-DD"
---
```

## Required Sections

14. **Every context file must have exactly these sections in order:**

| Section | Purpose |
|---------|---------|
| `# PRJ_NNN: Title` | H1 header matching frontmatter |
| `## Desired Outcome` | What success looks like when complete |
| `## Reference` | Diagrams, ASCII art, or links to related materials (optional, remove section if empty) |
| `## Next Actions` | All steps required to achieve the outcome, in table format |

# Content Guidelines

## Desired Outcome Section

15. **What success looks like** - One paragraph describing the end state when this context is complete.
16. **No implementation details** - Focus on the outcome, not the approach.

## Reference Section

17. **Optional section** - Only include if there are diagrams, ASCII art, or links to reference. Remove the entire section if empty.
18. **Architecture diagrams** - ASCII diagrams showing flow, components, or structure.
19. **Links to related materials** - Other contexts, external docs, or `_reference/` files.
20. **Visual specifications allowed** - RGB values, icon names, key mappings, and styling constants belong here.
21. **No prose** - Just diagrams, tables, and links, keep it visual.

## Next Actions Section

Next actions are every step needed to achieve the desired outcome. Each action must be **E2E testable** - verifiable through the system's public interface only.

### E2E Testability Rule

22. **Black-box testable** - Each Next Action must be testable without accessing private/internal state. Ask: "Can I verify this using only CLI commands, file system checks, stdout/stderr, logs, or network responses?"

23. **No internal implementation details** - Don't describe what components do internally. Describe observable outcomes.

| Bad (internal) | Good (observable) |
|----------------|-------------------|
| "Agent calls RAG search 3 times" | "User sees similar contexts listed before proceeding" |
| "Writer module validates input" | "Invalid input displays error message" |
| "Cache stores session data" | "Restarting preserves previous session" |
| "Parser extracts table columns" | "Command outputs table values from context file" |

### Table Format

24. **Use table format** - Two columns: Description (human-readable) and Test (function name without `test_` prefix).
25. **Description column** - Start with verbs: "Implement", "Create", "Add", "Define", "Configure", "Require".
26. **Test column is snake_case** - Must be valid Rust function identifier (e.g., `session_creates_knowledge`).
27. **test_ prefix added in test file** - Context uses `session_creates_knowledge`, test file uses `test_session_creates_knowledge`.
28. **Include all verifiable behaviors** - User-facing actions, error handling, edge cases, prerequisites.
29. **Embed key types inline** - Use backticks for type names (e.g., "Implement `FileWatcher` service").

Example table format:
```markdown
| Description | Test |
|-------------|------|
| Dropping session file into watch dir creates knowledge entry in database | `session_creates_knowledge` |
| Malformed session file is skipped and warning appears in logs | `malformed_session_logs_warning` |
| After rate-limit response, retry succeeds within 60 seconds | `rate_limit_retry_succeeds` |
| SIGTERM during extraction completes current file before exit | `graceful_shutdown_completes` |
| Command fails with error message when Claude Proxy not running | `missing_proxy_shows_error` |
| Setting `GRAPHITI_URL` env var changes target endpoint | `graphiti_url_changes_endpoint` |
```

30. **Test folders inside crate's tests/ directory** - Tests go in `crates/<crate>/tests/<context_id>/test_<name>.rs`.
   - `.nexus/context/nexus-tui/navigation/TUI_001-sidebar-navigation.md` → `crates/nexus-tui/tests/tui_001_sidebar_navigation/test_<name>.rs`
   - Context ID uses **lowercase with underscores** in folder name.



# Index File (index.md)

## Purpose

34. **Operational knowledge for a project or feature** - Not a context spec, a reference document.
35. **No frontmatter required** - It's not a numbered context.

## Required Sections

36. **Project index.md should include:**

| Section | Content |
|---------|---------|
| Overview | What the project does, how it's invoked |
| Architecture | ASCII diagram of system components |
| CLI Usage | Command examples (if applicable) |
| Key Dependencies | Table of crates/packages and their purpose |
| Environment Variables | Config options with defaults |
| Debugging & Troubleshooting | Common issues and solutions |

37. **Feature index.md should include:**

| Section | Content |
|---------|---------|
| Scope | What this feature owns and what it does not own |
| Context Files | List of context IDs in this feature |
| Interfaces | User-visible commands/APIs/events owned by the feature |
| Dependencies | Upstream/downstream feature or project dependencies |
| Troubleshooting | Feature-specific debugging notes |

# Anti-Patterns

## What NOT to Include

38. **No code in context specs** - No code snippets, no pseudocode, no implementation examples in numbered context files (PRJ_NNN). Code belongs in the codebase. The only exceptions are shell commands in the Validation section and files in `_reference/` subdirectory (design docs, decisions, research may include code examples).
39. **No file tree diffs** - Let rules handle structure conventions.
40. **No implementation details** - Describe what, not how.
41. **No mock servers or test doubles** - Tests use real services.
42. **No CI/CD configuration** - Unless that's the context's purpose.
43. **No unit or integration tests** - Only E2E tests matter.

## Common Mistakes

44. **Solving multiple problems in one context** - Split into separate context files.
45. **Mixing specification with documentation** - index.md is docs, PRJ_NNN is spec.
46. **Flat project-only context layout for multi-domain work** - Use feature folders to keep context ownership explicit.

# Context File Template

Use this template when creating new context files. **Do NOT include HTML comments** - the template below shows the minimal required structure:

```markdown
---
context_id: PRJ_001
title: Context Title
project: project-name
feature: feature-name
created: "YYYY-MM-DD"
---

# PRJ_001: Title

## Desired Outcome

<One paragraph describing the desired outcome.>

## Next Actions

| Description | Test |
|-------------|------|
| Implement `TypeName` for <purpose> | `type_name_implemented` |
| Create `ServiceName` service to handle <responsibility> | `service_name_created` |
| Require <external dependency> running on port <port> | `dependency_required` |
| Configure via `ENV_VAR` environment variable | `env_var_config` |
| User action results in expected outcome | `action_outcome` |
| Error condition is handled with expected behavior | `error_handled` |
| Edge case works correctly | `edge_case` |
```
