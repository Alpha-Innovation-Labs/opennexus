---
project_id: nexus-adapter
title: Nexus Adapter
created: "2026-02-26"
status: active
dependencies:
  - nexus-cli
  - cdd-web-ui
---

# nexus-adapter

## Overview

`nexus-adapter` defines the integration boundary between web applications and the OpenNexus CLI orchestration system. It standardizes command execution, run control, and structured status/query responses so UI features can trigger and observe orchestration without coupling to internal storage.

## Features

| Feature | Path | Purpose |
|---------|------|---------|
| `cli-bridge` | `.nexus/context/nexus-adapter/cli-bridge/` | Adapter contract for start/stop/restart controls and orchestration query integration |

## Architecture

```text
Web UI Features (graph/workspace)
            |
            v
      Nexus Adapter Layer
   (typed command/query bridge)
            |
            v
      OpenNexus CLI Surface
            |
            v
   Orchestration Runtime + SQLite
```

## CLI Usage

```bash
# Start a pipeline for one context
opennexus orchestration <pipeline_name> --context-file <path>

# Control active execution
opennexus orchestration stop --context-file <path>
opennexus orchestration restart <pipeline_name> --context-file <path>
opennexus orchestration active --context-file <path>

# Query execution state
opennexus orchestration status --context-file <path> --format json
opennexus orchestration runs --context-file <path> --format json
opennexus orchestration timeline --context-file <path> --format json
```

## Project Dependencies

| Dependency | Purpose |
|------------|---------|
| `nexus-cli` | Provides orchestration command surface and output contracts consumed by adapter integrations |
| `cdd-web-ui` | Primary downstream consumer that relies on adapter execution/query behavior |

## Blocking Dependencies

- If command semantics change, update adapter contracts only after corresponding `nexus-cli/orchestration` contexts are complete.
- If restart policy changes, adapter behavior must align with orchestration guardrails before release.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXUS_ADAPTER_OPENER` | `opennexus` | CLI binary used by adapter process execution |
| `NEXUS_ADAPTER_QUERY_TIMEOUT_MS` | `8000` | Query command timeout bound for UI-facing requests |

## Debugging & Troubleshooting

- If adapter reports unknown commands, verify installed CLI version supports orchestration control/query commands.
- If run control appears stale, verify `status` and `active` responses with `--format json` for the same context path.
- If restart does not create a fresh run, verify adapter uses hard-restart semantics with overwrite behavior.
