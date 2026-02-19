---
context_id: CLI_005
title: Project Management Commands
project: nexus-cli
created: "2025-01-04"
---

# CLI_005: Project Management Commands

## Desired Outcome

The CLI provides commands to list, create, and delete projects. Projects are directories under `.context/` with a 3-letter prefix convention. The commands support JSON output for scripting.

## Next Actions

| Description | Test |
|-------------|------|
| just run project list shows all projects with counts| `project_list_shows_counts` |
| just run project list --json outputs valid JSON| `project_list_json_output` |
| just run project create foo creates .context/foo/ with index.md| `project_create_with_index` |
| just run project create foo --prefix BAR uses custom prefix| `project_create_custom_prefix` |
| just run project create foo fails if project already exists| `project_create_already_exists` |
| just run project delete foo prompts for confirmation| `project_delete_prompts` |
| just run project delete foo --force deletes without prompt| `project_delete_force` |
| just run project delete nonexistent shows error| `project_delete_nonexistent` |
