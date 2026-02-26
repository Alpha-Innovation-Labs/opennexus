---
context_id: MKT_001
title: Marketplace Search Command
project: nexus-cli
feature: marketplace
created: "2026-02-23"

depends_on:
  contexts:
    - id: CLI_003
      why: This dependency outcome is required before this context can proceed.
---

# MKT_001: Marketplace Search Command

## Desired Outcome

Users can discover marketplace packages through `opennexus marketplace search` using id, name, or description matching. Search works with both default and overridden registry sources, and returns clear text or JSON output that supports interactive use and scripting.

## Next Actions

| Description | Test |
|-------------|------|
| `opennexus marketplace search fumadocs` returns matching entries with install hint text | `marketplace_search_returns_matches` |
| `opennexus marketplace search <query>` with no matches shows a no-results message without failing | `marketplace_search_no_results_message` |
| `opennexus --format json marketplace search fumadocs` outputs valid JSON containing query and results | `marketplace_search_json_output` |
| `opennexus marketplace search` without a query fails with a clap usage error | `marketplace_search_requires_query` |
| `NEXUS_MARKETPLACE_REGISTRY_URL=file://...` overrides the default registry source for search | `marketplace_search_registry_env_override` |
| Invalid registry JSON returns a clear parse failure error to the user | `marketplace_search_invalid_registry_error` |
| `just marketplace-search <query>` runs search against the local registry file | `marketplace_search_just_recipe_work` |
