---
project_id: nexus-cli-marketplace
title: Nexus CLI Marketplace
created: "2026-02-27"
status: active
dependencies:
  - nexus-cli
---

# nexus-cli marketplace

## Scope

Owns marketplace discovery and installation workflows exposed by `opennexus marketplace ...`, including registry lookup, package resolution, and installation of contexts/skills/rules from supported sources.

## Context Files

| ID | Title | Status |
|----|-------|--------|
| MKT_001 | Marketplace Search Command | Active |
| MKT_002 | Marketplace Install Command | Active |

## Interfaces

| Interface | Description |
|-----------|-------------|
| `opennexus marketplace search <query>` | Finds registry entries by id/name/description |
| `opennexus marketplace install <target>` | Installs a registry entry or GitHub source package |
| `NEXUS_MARKETPLACE_REGISTRY_URL` | Overrides default marketplace registry source |
| `just marketplace-search` | Runs marketplace search against local registry |
| `just marketplace-install <target>` | Runs marketplace install against local registry |

## Dependencies

| Dependency | Purpose |
|------------|---------|
| `nexus-cli` | Provides command runtime and installation lifecycle behavior used by marketplace flows |

## Troubleshooting

- Symptom: `Unknown marketplace target`.
  - Cause: Target is neither a valid registry id/name nor `github.com/<owner>/<repo>`.
  - Fix: Use `marketplace search` first or provide full GitHub source format.
- Symptom: Registry fetch fails.
  - Cause: Network issue or invalid `NEXUS_MARKETPLACE_REGISTRY_URL` value.
  - Fix: Verify URL reachability or set `NEXUS_MARKETPLACE_REGISTRY_URL=file://$(pwd)/.nexus/marketplace/registry.json`.
- Symptom: Install fails with missing package directory.
  - Cause: Repository does not include expected `.nexus` package paths.
  - Fix: Validate repository layout and registry `path` values.
