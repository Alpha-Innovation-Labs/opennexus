# Run opennexus locally with arbitrary arguments
# Usage: just run <args...>
# Example: just run marketplace install fumadocs

run *ARGS:
    cargo run --bin opennexus -- {{ARGS}}
