---
context_id: CLI_004
title: Uninstall Command
project: nexus-cli
feature: core
created: "2025-01-04"

depends_on:
  contexts:
    - id: CLI_003
      why: This dependency outcome is required before this context can proceed.
---

# CLI_004: Uninstall Command

## Desired Outcome

Running `opennexus uninstall` removes the globally installed `opennexus` binary from the system. It detects the installation location and uses the appropriate method (cargo uninstall or direct removal).

## Next Actions

| Description | Test |
|-------------|------|
| Parse and execute `opennexus uninstall` without error | `uninstall_parses` |
| Detect current installation location | `uninstall_detects_location` |
| Remove the opennexus binary from the system | `uninstall_removes_binary` |
| Show success message after removal | `uninstall_shows_success` |
| Handle case where opennexus is not installed | `uninstall_handles_not_installed` |
| Exit with code 0 on successful uninstall | `uninstall_exits_zero` |
| Exit with non-zero code on failure | `uninstall_fails_gracefully` |
