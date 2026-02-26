---
context_id: ORC_002
title: Typed Step Contracts and Step Registry
project: nexus-cli
feature: orchestration
created: "2026-02-26"
depends_on:
  contexts:
    - ORC_001
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
