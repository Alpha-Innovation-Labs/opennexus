# Ralph Feature Surface Map

Source reviewed: `/opt/homebrew/lib/node_modules/@th0rgal/ralph-wiggum/ralph.ts` (v1.2.1)

## Feature Groups

| Group | User-Visible Capability | Context ID |
|-------|-------------------------|------------|
| Command surface | Help/version, option parsing, aliases, passthrough `--`, command family | `CLI_009` |
| Loop lifecycle | Start/resume/stop semantics, state/history file lifecycle, SIGINT cleanup | `CLI_010` |
| Backend orchestration | Backend selection, model routing, binary overrides, rotation policy | `CLI_011` |
| Context and tasks commands | `--status`, `--add-context`, `--clear-context`, task CRUD and display | `CLI_012` |
| Promise and iteration gates | Completion/abort/task promise detection, min/max iteration gating | `CLI_013` |
| Telemetry and commits | Streaming, heartbeat, tool summary, history metrics, struggle signals, auto-commit | `CLI_014` |
| Prompt construction | Prompt source precedence, tasks-mode prompt text, custom template variables | `CLI_015` |
| Diagnostics and recovery | Missing binary/model guidance, placeholder plugin detection, recoverable failure behavior | `CLI_016` |

## Runtime Files in `.ralph/`

| Path | Purpose |
|------|---------|
| `.ralph/ralph-loop.state.json` | Active loop state and resume metadata |
| `.ralph/ralph-history.json` | Iteration history and struggle indicators |
| `.ralph/ralph-context.md` | Pending context injected on next iteration |
| `.ralph/ralph-tasks.md` | Markdown task list used by tasks mode |
| `.ralph/ralph-opencode.config.json` | Generated OpenCode config for plugin filtering/permissions |
