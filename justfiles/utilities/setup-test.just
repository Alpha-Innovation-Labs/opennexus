# Run setup in a fresh temp directory
# Usage: just setup-test
# Example: just setup-test

setup-test:
    #!/usr/bin/env bash
    set -euo pipefail

    rm -rf tmp
    mkdir tmp
    cd tmp
    opennexus setup
