# Run setup with local binary
# Usage: just setup [harness]
# Example: just setup
# Example: just setup opencode

setup harness="opencode":
    cargo run --bin opennexus -- setup --harness {{harness}}
