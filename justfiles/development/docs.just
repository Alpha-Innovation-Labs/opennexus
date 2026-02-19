# Run local docs app from docs/
# Usage: just docs
# Example: just docs

docs:
    mkdir -p logs
    rm -f docs/.next/dev/lock
    cd docs && bun install && bun run dev 2>&1 | tee ../logs/docs.log

# Generate reference docs from Rust doc comments
# Usage: just docs-sync
# Example: just docs-sync

docs-sync:
    cargo run --bin docs-sync -- sync
