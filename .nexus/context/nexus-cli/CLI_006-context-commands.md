---
context_id: CLI_006
title: Context Management Commands
project: nexus-cli
created: "2025-01-04"
---

# CLI_006: Context Management Commands

## Desired Outcome

The CLI provides commands to list, show, create, update, delete, move, and reorder contexts. Context IDs follow the `PRJ_NNN` pattern. Moving and reordering updates file names and cross-references throughout the project.

## Next Actions

| Description | Test |
|-------------|------|
| just run context list shows all contexts | `context_list_all` |
| just run context list nexus shows only Nexus project contexts | `context_list_project_filter` |
| just run context list --json outputs valid JSON with all fields | `context_list_json` |
| just run context show NEX_001 displays full context | `context_show` |
| just run context show INVALID shows error | `context_show_invalid` |
| just run context create nexus creates next sequential context | `context_create_sequential` |
| just run context delete NEX_003 prompts for confirmation | `context_delete_prompts` |
| just run context delete NEX_003 --force skips confirmation | `context_delete_force` |
| context delete automatically reorders subsequent contexts (004→003, 005→004) | `context_delete_reorders` |
| context delete --no-reorder leaves gaps in numbering | `context_delete_no_reorder` |
| context delete updates frontmatter context_id in renumbered files | `context_delete_updates_frontmatter` |
| context delete updates H1 header in renumbered files | `context_delete_updates_header` |
| context delete renames test directories (NEX_004_foo → NEX_003_foo) | `context_delete_renames_test_dirs` |
| context delete updates context ID in test file doc comments | `context_delete_updates_test_comments` |
| just run context move NEX_003 --to 1 renumbers contexts | `context_move_renumbers` |
| just run context move updates cross-references in other files | `context_move_updates_refs` |
| context move renames test directories to match new IDs | `context_move_renames_test_dirs` |
| just run context reorder nexus removes gaps (001, 003, 005 → 001, 002, 003) | `context_reorder_removes_gaps` |
| just run context reorder updates cross-references | `context_reorder_updates_refs` |
| context reorder renames test directories to match new IDs | `context_reorder_renames_test_dirs` |
| reference "see NEX_005" becomes "see NEX_003" after reorder | `reference_renumber_after_reorder` |
