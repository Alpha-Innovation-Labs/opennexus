---
context_id: NEX_003
title: Build Optimization with sccache
project: nexus
feature: build
created: "2026-01-09"

depends_on:
  contexts:
    - id: NEX_001
      why: This dependency outcome is required before this context can proceed.
---

# NEX_003: Build Optimization with sccache

## Desired Outcome

Small code changes compile in seconds, not minutes. Third-party crates (lance, aws-sdk, etc.) are cached and never recompile unless their versions change. The macOS Gatekeeper "Verifying" dialog never appears when running locally-built binaries. Developers can run `cargo clean` and rebuild quickly because sccache preserves compiled artifacts outside the target directory.

## Next Actions

| Description | Test |
|-------------|------|
| sccache is configured as rustc wrapper in .cargo/config.toml | `sccache_configured` |
| Incremental compilation is disabled for dev profile | `incremental_disabled_dev` |
| Incremental compilation is disabled for release profile | `incremental_disabled_release` |
| Small code change only recompiles project crates, not dependencies | `incremental_build_fast` |
| Cache hit rate exceeds 95% after initial build | `cache_hit_rate_high` |
| just tui codesigns binary to prevent Gatekeeper dialog | `tui_codesigns_binary` |
| just build codesigns binary to prevent Gatekeeper dialog | `build_codesigns_binary` |
| Rebuild after cargo clean uses sccache for dependencies | `clean_rebuild_uses_cache` |
