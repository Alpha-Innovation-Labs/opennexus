---
context_id: CLI_005
title: Update Command
project: nexus-cli
feature: core
created: "2025-01-04"

depends_on:
  contexts:
    - id: CLI_004
      why: This dependency outcome is required before this context can proceed.
---

# CLI_005: Update Command

## Desired Outcome

Running `opennexus update` checks for newer versions of the CLI and updates the global installation if a newer version is available. It fetches the latest version from the configured source (cargo registry or direct binary).

## Next Actions

| Description | Test |
|-------------|------|
| Parse and execute `opennexus update` without error | `update_parses` |
| Check current installed version | `update_checks_current_version` |
| Query latest available version from registry | `update_queries_latest` |
| Compare versions and determine if update needed | `update_compares_versions` |
| Download and install newer version when available | `update_installs_newer` |
| Show message when already on latest version | `update_shows_current` |
| Handle network errors gracefully | `update_handles_network_error` |
| Handle case where opennexus is not installed | `update_handles_not_installed` |
| Exit with code 0 on successful update | `update_exits_zero` |
| Exit with non-zero code on failure | `update_fails_gracefully` |
