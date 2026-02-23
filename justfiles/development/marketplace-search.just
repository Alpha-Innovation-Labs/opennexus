# Search marketplace entries with local binary
# Usage: just marketplace-search <query>
# Example: just marketplace-search fumadocs

marketplace-search *QUERY:
    NEXUS_MARKETPLACE_REGISTRY_URL="file://$(pwd)/.nexus/marketplace/registry.json" cargo run --bin opennexus -- marketplace search "{{QUERY}}"
