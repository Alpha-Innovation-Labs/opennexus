# Verify generated docs are up to date
# Usage: just docs-sync-check
# Example: just docs-sync-check

docs-sync-check:
    cargo run --bin docs-sync -- check
