---
project_id: nexus-cli
title: Nexus CLI - Thin Client
created: "2024-12-01"
status: active
dependencies:
  - nexus-client
---

# nexus-cli

## Context Files

| ID | Title | Status |
|----|-------|--------|
| CLI_001 | Baseline CLI | Completed |
| CLI_003 | Clap Migration | Completed |
| CLI_005 | Project Commands | Active |
| CLI_006 | Context Commands | Active |

## Overview

Nexus CLI is a thin client that communicates with the Nexus server via nexus-client. It provides command-line access to all Nexus functionality including workflow execution, context management, and project management. The CLI parses arguments, delegates to the server, and displays streaming output.

## Architecture

```
nexus-cli
└── Binary (src/main.rs)
    ├── cli.rs         → Clap definitions
    ├── commands/
    │   ├── server.rs  → start, stop, status
    │   ├── workflow.rs → gen-tests, manage-context, gen-code
    │   ├── context.rs → list, show, create, update, delete
    │   └── project.rs → list, create, delete
    └── output.rs      → Streaming output formatting
```

## CLI Usage

```bash
# Server management
nexus server start       # Start server daemon
nexus server stop        # Stop server
nexus server status      # Check server status

# Workflow commands (delegated to server)
nexus gen-tests --context CLI_013 --action spawns_write_agent
nexus context manage --project nexus-cli
nexus gen-code --context CLI_013 --action spawns_write_agent

# Context management (can be local or delegated)
nexus context list [<project>] [--json]
nexus context show <id>
nexus context create <project>
nexus context update <id>
nexus context delete <id>

# Project management
nexus project list [--json]
nexus project create <name>
nexus project delete <name> [--force]

# Setup (local operation)
nexus setup
nexus setup -p opencode
nexus setup -p claude

# Launch TUI
nexus tui                # Launch terminal user interface
```

## Key Dependencies

| Crate | Purpose |
|-------|---------|
| clap | CLI argument parsing with derive |
| nexus-client | Server communication |
| tokio | Async runtime |
| serde_json | JSON output formatting |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| NEXUS_SERVER_URL | unix:~/.local/nexus/nexus.sock | Server connection |

## Server Logging

The Nexus server writes logs to `~/.local/share/nexus/logs/nexus.log`. Use `nexus server logs` to view them.

## Thin Client Behavior

The CLI is intentionally minimal:

1. **Parse arguments** - Clap handles all argument parsing
2. **Connect to server** - Via nexus-client
3. **Send request** - Workflow or query
4. **Stream output** - Display events as they arrive
5. **Exit** - With appropriate exit code

All business logic lives in the server and workflows. The CLI is just a terminal interface.

## Daemon Lifecycle Responsibility

**IMPORTANT**: The CLI (not the TUI) is responsible for daemon auto-start.

| Component | Daemon Responsibility |
|-----------|----------------------|
| nexus CLI | Auto-starts daemon if not running, then executes command |
| nexus tui | Assumes daemon is running, shows error if not |

When a user runs any `nexus` command:

1. CLI checks if daemon is running
2. If not running, CLI spawns daemon as detached background process
3. CLI waits for daemon to be ready
4. CLI proceeds with the requested operation

This ensures:
- `nexus tui` can assume the daemon is running (launched via CLI)
- Single point of daemon lifecycle management
