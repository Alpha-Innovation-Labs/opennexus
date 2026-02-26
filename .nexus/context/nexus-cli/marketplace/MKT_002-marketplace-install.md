---
context_id: MKT_002
title: Marketplace Install Command
project: nexus-cli
feature: marketplace
created: "2026-02-23"

depends_on:
  contexts:
    - id: MKT_001
      why: This dependency outcome is required before this context can proceed.
---

# MKT_002: Marketplace Install Command

## Desired Outcome

Users can install marketplace packages through `opennexus marketplace install` by registry id/name or by GitHub repository source. Installation copies compatible assets into expected `.nexus/` paths for contexts, skills, and rules, and returns clear success/error output in both text and JSON modes.

## Next Actions

| Description | Test |
|-------------|------|
| `opennexus marketplace install fumadocs` installs registry context assets into `.nexus/context/fumadocs` | `marketplace_install_registry_context_package` |
| `opennexus marketplace install github.com/<owner>/<repo>` installs bundle assets from repository `.nexus/` package | `marketplace_install_github_bundle` |
| `opennexus marketplace install https://github.com/<owner>/<repo>.git` is accepted as a valid GitHub source format | `marketplace_install_accepts_https_git_target` |
| `opennexus --format json marketplace install fumadocs` outputs completion JSON with installed counts | `marketplace_install_json_output` |
| Unknown install targets return actionable error text with accepted target formats | `marketplace_install_invalid_target_error` |
| Missing package directories in a source repository return clear install failure output | `marketplace_install_missing_package_error` |
| Rule package install copies rule file assets into `.nexus/ai_harness/rules` | `marketplace_install_rule_assets` |
| Bundle installs support both `.nexus/ai_harness/skills` and legacy `.nexus/skills` source layouts | `marketplace_install_supports_legacy_skill_layout` |
| `NEXUS_MARKETPLACE_REGISTRY_URL=file://...` overrides the default registry source for install by id/name | `marketplace_install_registry_env_override` |
| `just marketplace-install <target>` runs install against the local registry file | `marketplace_install_just_recipe_work` |
