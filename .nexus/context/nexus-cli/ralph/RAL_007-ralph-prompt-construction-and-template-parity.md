---
context_id: CLI_015
title: Ralph Prompt Construction and Template Parity
project: nexus-cli
feature: ralph
created: "2026-02-23"
---

# CLI_015: Ralph Prompt Construction and Template Parity

## Desired Outcome

`opennexus ralph` constructs iteration prompts with behavior equivalent to the current Ralph CLI, including prompt source precedence, prompt-file validation, context injection, tasks-mode prompt shaping, and custom prompt-template variable interpolation.

## Next Actions

| Description | Test |
|-------------|------|
| Accept inline positional prompt text and preserve multi-word task descriptions as a single task prompt | `ralph_accepts_inline_prompt_text` |
| Accept prompt from `--prompt-file` and reject missing path, non-file path, unreadable file, or empty file | `ralph_prompt_file_validates_missing_invalid_and_empty_input` |
| Treat a single positional argument that resolves to an existing file path as prompt-file input | `ralph_single_positional_file_path_loads_prompt_content` |
| Reuse active-state prompt when no new prompt is provided during resume workflows | `ralph_resume_uses_saved_prompt_when_not_provided` |
| Inject pending context content into generated prompts and clear only after consumption | `ralph_prompt_includes_pending_context_once_per_consumed_iteration` |
| Build tasks-mode prompts with current/next task guidance and strict promise instructions | `ralph_tasks_mode_prompt_contains_task_workflow_guidance` |
| Apply `--prompt-template` file with supported variables for iteration, promises, prompt, context, and tasks | `ralph_prompt_template_interpolates_supported_variables` |
| Reject missing prompt-template file with actionable diagnostics | `ralph_prompt_template_missing_file_returns_error` |
