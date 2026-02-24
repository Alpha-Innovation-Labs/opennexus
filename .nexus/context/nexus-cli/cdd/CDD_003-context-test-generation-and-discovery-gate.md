---
context_id: CDD_003
title: Context Test Generation and Discovery Gate
project: nexus-cli
feature: cdd
created: "2026-02-23"
---

# CDD_003: Context Test Generation and Discovery Gate

## Desired Outcome

`opennexus context implement --context-file <path>` parses the context structure, extracts all `Test` identifiers from `Next Actions`, generates discoverable test cases before coding begins, and blocks coding when generated tests are not verifiable by repository test discovery.

## Next Actions

| Description | Test |
|-------------|------|
| Validate context frontmatter and required sections before test generation starts | `context_implement_validates_context_structure_before_test_generation` |
| Parse `Next Actions` rows and extract unique snake_case `Test` identifiers | `context_implement_extracts_unique_test_identifiers_from_next_actions` |
| Generate test files or test cases that map one-to-one to extracted test identifiers | `context_implement_generates_test_cases_for_each_extracted_identifier` |
| Run test discovery and confirm generated tests are discoverable before coding stage runs | `context_implement_blocks_coding_when_generated_tests_are_not_discoverable` |
| Emit actionable failure output when context parsing or test generation fails | `context_implement_reports_actionable_errors_for_test_generation_failures` |
