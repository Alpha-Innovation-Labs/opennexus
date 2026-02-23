# Run local docs app from docs/
# Usage: just docs
# Example: just docs

docs:
    mkdir -p logs
    rm -f docs/.next/dev/lock
    cd docs && bun install && bun run dev 2>&1 | tee ../logs/docs.log

# Check reference docs sync state
# Usage: just docs-sync
# Example: just docs-sync

docs-sync:
    cargo run --bin docs-sync -- check
