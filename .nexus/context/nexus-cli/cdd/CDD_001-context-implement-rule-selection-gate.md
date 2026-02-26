---
context_id: CDD_001
title: Context Implement Rule Selection Gate
project: nexus-cli
feature: cdd
created: "2026-02-23"

depends_on:
  contexts:
    - id: CLI_003
      why: This dependency outcome is required before this context can proceed.
---

# CDD_001: Context Implement Rule Selection Gate

## Desired Outcome

`opennexus context implement --context-file <path>` enforces coding-rule selection before any coding stage by discovering coding-related rule files, printing discovered filenames, selecting exactly one rule when confident, and blocking execution with user action when selection is ambiguous or uncertain.

## Next Actions

| Description | Test |
|-------------|------|
| Discover coding-related files only from `.nexus/ai_harness/rules/` and print discovered filenames before any selection step | `context_implement_lists_discovered_rule_filenames` |
| Select exactly one coding rule automatically only when one clear dominant rule exists | `context_implement_auto_selects_single_dominant_rule` |
| Block orchestration and request explicit user selection when multiple candidate coding rules exist | `context_implement_blocks_on_multiple_rule_candidates` |
| Block orchestration and request explicit user input when rule confidence is insufficient | `context_implement_blocks_on_uncertain_rule_selection` |
| Continue without rule selection when no coding-related rule files are discovered | `context_implement_continues_without_rule_when_none_exist` |
| Apply the selected coding rule as a hard constraint to every coding-agent invocation in loop iterations | `context_implement_applies_selected_rule_to_coding_agent_calls` |
