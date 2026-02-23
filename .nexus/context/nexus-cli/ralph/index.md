# nexus-cli ralph

## Scope

Owns parity delivery for `opennexus ralph`, replacing the current Bun/TypeScript `ralph` runtime with a Rust implementation that preserves CLI behavior, loop semantics, and operator workflows.

## Context Files

| ID | Title | Status |
|----|-------|--------|
| CLI_009 | Ralph Command Surface Parity | Planned |
| CLI_010 | Ralph Loop State Lifecycle | Planned |
| CLI_011 | Ralph Agent Backend and Rotation Parity | Planned |
| CLI_012 | Ralph Context and Tasks Command Parity | Planned |
| CLI_013 | Ralph Promise and Iteration Control Parity | Planned |
| CLI_014 | Ralph Iteration Telemetry and Auto-Commit Parity | Planned |
| CLI_015 | Ralph Prompt Construction and Template Parity | Planned |
| CLI_016 | Ralph Diagnostics and Recovery Parity | Planned |

## Interfaces

| Interface | Description |
|-----------|-------------|
| `opennexus ralph "<prompt>" [options]` | Runs iterative Ralph loop with prompt and options |
| `opennexus ralph --prompt-file <path>` | Loads prompt text from a file with validation for missing/empty input |
| `opennexus ralph --prompt-template <path>` | Applies custom iteration prompt template variables |
| `opennexus ralph --agent <name> --model <name>` | Selects backend and model for loop execution |
| `opennexus ralph --rotation "agent:model,..."` | Rotates backend/model selection per iteration |
| `opennexus ralph --status` | Shows active loop state, context, tasks, and recent history |
| `opennexus ralph --status --tasks` | Shows status plus indexed markdown task progress |
| `opennexus ralph --add-context "<text>"` | Appends mid-loop context for next iteration |
| `opennexus ralph --clear-context` | Clears pending context injection file |
| `opennexus ralph --list-tasks` | Shows tasks from `.ralph/ralph-tasks.md` with indices |
| `opennexus ralph --add-task "<description>"` | Adds a top-level task entry |
| `opennexus ralph --remove-task <n>` | Removes indexed task and nested subtasks |
| `opennexus ralph --allow-all|--no-allow-all` | Controls auto-approval permission mode where supported |
| `opennexus ralph --no-stream` | Buffers subprocess output and prints once per iteration |
| `opennexus ralph --no-plugins` | Filters non-auth OpenCode plugins for the run |
| `opennexus ralph --no-commit` | Disables per-iteration Git auto-commit |

## Dependencies

| Dependency | Purpose |
|------------|---------|
| `clap` | Parse Ralph command and option surface |
| `serde` / `serde_json` | Persist `.ralph` state/history/config files |
| `tokio` + process I/O | Spawn agent subprocesses and stream output |
| `regex` | Promise detection, tool extraction, and output parsing |
| `git` (system command) | Snapshot changes and optional per-iteration auto-commit |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RALPH_OPENCODE_BINARY` | `opencode` | Overrides OpenCode CLI binary path |
| `RALPH_CLAUDE_BINARY` | `claude` | Overrides Claude Code CLI binary path |
| `RALPH_CODEX_BINARY` | `codex` | Overrides Codex CLI binary path |
| `RALPH_COPILOT_BINARY` | `copilot` | Overrides Copilot CLI binary path |

## Troubleshooting

- Symptom: `opennexus ralph` exits immediately with agent not found.
  - Cause: Selected agent CLI is not installed or not in `PATH`.
  - Fix: Install the CLI or point to explicit binary via agent-specific environment override.
- Symptom: Loop appears stuck with no visible output.
  - Cause: Agent output is sparse or buffered.
  - Fix: Verify heartbeat lines appear and run without `--no-stream` for live output.
- Symptom: Completion is never detected.
  - Cause: Agent output does not include an exact `<promise>...</promise>` tag.
  - Fix: Confirm configured promise text and ensure tag is emitted directly.
- Symptom: OpenCode fails with model/provider resolution errors.
  - Cause: No default model configured or invalid model name.
  - Fix: Configure a default model in OpenCode config or pass `--model` explicitly.
- Symptom: Loop repeats with no meaningful file changes.
  - Cause: Agent is stuck or lacks sufficient direction.
  - Fix: Use `--add-context` to provide targeted guidance and inspect `--status` history struggle indicators.
