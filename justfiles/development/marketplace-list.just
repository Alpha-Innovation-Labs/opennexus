# List marketplace entries with local binary
# Usage: just marketplace-list

marketplace-list:
    NEXUS_MARKETPLACE_REGISTRY_URL="file://$(pwd)/.nexus/marketplace/registry.json" cargo run --bin opennexus -- marketplace list
