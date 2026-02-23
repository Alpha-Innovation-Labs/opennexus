# Run Ralph via opennexus passthrough
# Usage: just ralph <args...>
# Example: just ralph "Implement OAuth callback" --max-iterations 5

ralph *ARGS:
    cargo run --bin opennexus -- ralph {{ARGS}}
