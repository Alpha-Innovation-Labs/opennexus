---
context_id: CLI_007
title: Marketplace Search Command
project: nexus-cli
feature: marketplace
created: "2026-02-23"
---

# CLI_007: Marketplace Search Command

## Desired Outcome

Users can discover marketplace packages through `opennexus marketplace search` using id, name, or description matching. Search works with both default and overridden registry sources, and returns clear text or JSON output that supports interactive use and scripting.

## Next Actions

| Description | Test |
|-------------|------|
| `opennexus marketplace search fumadocs` returns matching entries with install hint text | `marketplace_search_returns_matches` |
| `opennexus marketplace search <query>` with no matches shows a no-results message without failing | `marketplace_search_no_results_message` |
| `opennexus --format json marketplace search fumadocs` outputs valid JSON containing query and results | `marketplace_search_json_output` |
| `opennexus marketplace search` handles empty query input by returning full registry entries set | `marketplace_search_empty_query_lists_entries` |
| `NEXUS_MARKETPLACE_REGISTRY_URL=file://...` overrides the default registry source for search | `marketplace_search_registry_env_override` |
| Invalid registry JSON returns a clear parse failure error to the user | `marketplace_search_invalid_registry_error` |
| `just marketplace-search <query>` runs search against the local registry file | `marketplace_search_just_recipe_work` |
