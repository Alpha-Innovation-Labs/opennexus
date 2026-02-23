# Install marketplace target with local binary
# Usage: just marketplace-install <target>
# Example: just marketplace-install fumadocs

marketplace-install TARGET:
    NEXUS_MARKETPLACE_REGISTRY_URL="file://$(pwd)/.nexus/marketplace/registry.json" cargo run --bin opennexus -- marketplace install {{TARGET}}
