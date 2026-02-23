---
context_id: CLI_002
title: Version Command
project: nexus-cli
feature: core
created: "2025-01-04"
---

# CLI_002: Version Command

## Desired Outcome

Running `opennexus --version` outputs the CLI version in a human-readable format. The version is read from the embedded crate version at compile time.

## Next Actions

| Description | Test |
|-------------|------|
| Parse and execute `opennexus --version` without error | `version_flag_parses` |
| Print version string in format `opennexus X.Y.Z` to stdout | `version_flag_outputs_format` |
| Exit with code 0 on successful version display | `version_flag_exits_zero` |
