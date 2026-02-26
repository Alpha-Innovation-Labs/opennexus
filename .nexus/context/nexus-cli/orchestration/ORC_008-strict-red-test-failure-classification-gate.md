---
context_id: ORC_008
title: Strict Red-Test Failure Classification Gate
project: nexus-cli
feature: orchestration
created: "2026-02-26"

depends_on:
  contexts:
    - id: ORC_007
      why: This dependency outcome is required before this context can proceed.
---

# ORC_008: Strict Red-Test Failure Classification Gate

## Desired Outcome

Red-test verification enforces behavioral failure semantics so generated tests are accepted only when they fail for expected behavior assertions and not for syntax, import, collection, or environment setup errors.

## Next Actions

| Description | Test |
|-------------|------|
| Execute red-test verification step against generated test targets before implementation steps begin | `orchestration_executes_red_test_verification_before_implementation_steps` |
| Classify failing red tests into behavioral and non-behavioral failure categories | `orchestration_classifies_red_test_failures_into_behavioral_and_non_behavioral_categories` |
| Block pipeline progression when any red test fails for syntax, import, collection, or setup reasons | `orchestration_blocks_progression_for_non_behavioral_red_test_failures` |
| Include per-test classification reasons and remediation hints in gate output | `orchestration_reports_red_test_classification_reasons_and_remediation_hints` |
| Persist red-test classification records for run timeline and API consumers | `orchestration_persists_red_test_classification_records_for_observability_consumers` |
