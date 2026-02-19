# OpenCode Model Detection Research

Research conducted for NEXUS_001 to understand how OpenCode determines the default model.

## Model Selection Priority in OpenCode

OpenCode determines the model through this priority chain:

1. **Explicit model parameter** (if provided when creating the session)
2. **Last used model in the session** (for continuing sessions)
3. **Config file `model` setting** (`~/.config/opencode/opencode.json`)
4. **Last used model from state** (`~/.local/state/opencode/model.json` - TUI only)
5. **First available provider's best model** (sorted by priority)

## Key Storage Locations

### TUI State File (Most Recent Models)

**Location:** `~/.local/state/opencode/model.json`

**Structure:**
```json
{
  "recent": [
    {"providerID": "anthropic", "modelID": "claude-sonnet-4-5"},
    {"providerID": "openai", "modelID": "gpt-5-chat"}
  ],
  "favorite": [
    {"providerID": "anthropic", "modelID": "claude-sonnet-4-5"}
  ],
  "variant": {}
}
```

**Key Finding:** The **first item in the `recent` array** is the last used model.

### Config File (Explicit Default)

**Location:** `~/.config/opencode/opencode.json`

### Session Messages (Per-Session Model)

**Location:** `~/.local/share/opencode/storage/message/`

Each message stores the model used, but querying is slow due to thousands of files.

## Relevant OpenCode Source Files

- `/packages/opencode/src/session/prompt.ts` - Model resolution logic
- `/packages/opencode/src/provider/provider.ts` - Default model selection
- `/packages/opencode/src/cli/cmd/tui/context/local.tsx` - TUI model store

## References

- OpenCode GitHub: https://github.com/sst/opencode
