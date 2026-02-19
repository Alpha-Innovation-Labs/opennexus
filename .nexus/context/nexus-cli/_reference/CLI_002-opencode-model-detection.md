---
context_id: CLI_002
title: OpenCode Default Model Detection Reference
project: nexus-cli
created: "2024-12-31"
type: reference
---

# CLI_002: OpenCode Default Model Detection Reference

This document describes how OpenCode stores and retrieves the user's last selected model from its TUI state.

## Storage Locations

| Priority | Location | Description |
|----------|----------|-------------|
| 1 | `$XDG_STATE_HOME/opencode/model.json` | Primary location (respects XDG spec) |
| 2 | `~/.local/state/opencode/model.json` | Fallback on most systems |

## Storage Format

```json
{
  "providerID": "openai",
  "modelID": "gpt-4o"
}
```

## CLI Format

When passing to CLI via `--model` flag, format as:

```
providerID/modelID
```

Example: `openai/gpt-4o`

## Related OpenCode Code Paths

- `/packages/opencode/src/session/prompt.ts` - Model resolution logic
- `/packages/opencode/src/provider/provider.ts` - Default model selection
- `/packages/opencode/src/cli/cmd/tui/context/local.tsx` - TUI model store
