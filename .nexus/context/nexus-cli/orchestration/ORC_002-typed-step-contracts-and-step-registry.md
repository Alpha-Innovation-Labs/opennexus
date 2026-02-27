---
context_id: ORC_002
title: Typed Step Contracts and Step Registry
project: nexus-cli
feature: orchestration
created: "2026-02-26"

depends_on:
  contexts:
    - id: ORC_001
      why: This dependency outcome is required before this context can proceed.
---

# ORC_002: Typed Step Contracts and Step Registry

## Desired Outcome

Pipelines execute via reusable independent steps with declared typed inputs and outputs so step ordering and composition can change without hardcoded orchestration assumptions.

## Next Actions

| Description | Test |
|-------------|------|
| Define a step contract that declares typed input and output payloads | `orchestration_step_contract_declares_typed_inputs_and_outputs` |
| Register step implementations by stable step key and reject duplicate keys | `orchestration_step_registry_rejects_duplicate_step_keys` |
| Validate pipeline wiring by ensuring each step input is satisfiable from prior outputs or initial context | `orchestration_validates_step_input_wiring_before_execution` |
| Execute ordered step sequence through a generic runner without step-specific branching in the runner | `orchestration_runner_executes_ordered_steps_without_step_specific_branching` |
| Return actionable errors when required step contracts are missing or incompatible | `orchestration_reports_actionable_missing_or_incompatible_step_contracts` |
| Dispatch step execution through reusable job modules so pipeline YAML controls step order and composition | `orchestration_dispatches_reusable_job_modules_from_pipeline_yaml` |
| Provide a reusable `opencode_prompt` job contract that accepts prompt template and mapped variables from prior step outputs | `orchestration_opencode_prompt_job_accepts_template_and_mapped_variables` |
| Enforce coding-step write policy in orchestration by rejecting test file edits when coding jobs are configured as source-only | `orchestration_rejects_test_file_mutations_during_source_only_coding_steps` |
| Register orchestration blocks from modular files and dispatch by unique `block_id` through a block registry | `orchestration_block_registry_dispatches_modular_blocks_by_unique_block_id` |
| Include a dedicated worktree assignment block that sets runtime working directory for downstream coding blocks | `orchestration_assign_worktree_block_sets_runtime_working_directory_for_downstream_blocks` |
| Persist assigned worktree path in step output so replay and restart continue in the same working directory | `orchestration_persists_assigned_worktree_path_for_replay_and_restart` |
