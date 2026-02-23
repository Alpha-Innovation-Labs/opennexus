---
description: Analyze git changes since last code sync and align contexts with implementation
---

# Command: Context Sync With Code

This command is code-diff-driven.

Read `.nexus/ai_harness/skills/context-driven-development/SKILL.md` first and use it as the only CDD source of truth.

Its job is to inspect repository code changes since the last code-sync checkpoint, compare those changes to existing context files, and recommend updates.

## Usage

```bash
/nexus-context-sync-with-code
```

No parameters required.

## State Tracking

Checkpoint state is stored in `.nexus/config.json` at:

- `context_sync.code.last_synced_commit`
- `context_sync.code.synced_at`

Expected shape:

```json
{
  "context_sync": {
    "code": {
      "last_synced_commit": "<git-sha>",
      "synced_at": "<utc-iso8601>"
    }
  }
}
```

## Hard Rules

1. Do not call other slash commands.
2. Do not spawn subagents.
3. Use git history + staged diff as source-of-truth, not chat narrative.
4. If no relevant code changes are found, do not fabricate context updates.
5. Use exactly one `question` tool call at the end to present recommended follow-up choices.

## Inputs To Analyze

1. Git changes since last checkpoint
2. Staged changes (`git diff --cached`)
3. `.nexus/context/**/PRJ_NNN-*.md` context files
4. `.nexus/context/**/index.md` project/feature docs
5. `.nexus/ai_harness/skills/context-driven-development/SKILL.md`

## Workflow

### Phase 1: Resolve Change Range

1. Read `.nexus/config.json` and resolve checkpoint:
   - If `context_sync.code.last_synced_commit` exists and is valid, use `<last_synced_commit>..HEAD`.
   - Else if upstream exists, use `@{upstream}...HEAD`.
   - Else use latest commit only (`HEAD`).
2. Collect changed files from:
   - `git diff --name-only --diff-filter=ACMRTUXB <range>`
   - `git diff --cached --name-only --diff-filter=ACMRTUXB`
3. Merge, dedupe, and sort file paths.

### Phase 2: Filter For Context-Relevant Changes

Keep only paths likely to affect context expectations:

- `src/**`
- `.nexus/ai_harness/**`
- `.nexus/context/**`
- `docs/**`
- `README.md`
- `llms.txt`

If no relevant paths remain, return an explicit no-change report.

### Phase 3: Align Code Changes To Existing Contexts

1. Map each relevant path and behavior change to existing context files.
2. Determine for each context:
   - aligned (already covered)
   - partial (needs Next Action/doc updates)
   - missing (new context candidate)
3. Identify affected project/feature indexes needing updates.

### Phase 4: Ask LLM To Propose Concrete Updates

Generate and use a concise prompt for the model that includes:

- change range used
- relevant file list
- instruction to align contexts/index docs with implementation changes
- strict target files for edits:
  - `.nexus/context/**/PRJ_NNN-*.md`
  - `.nexus/context/**/index.md`
- reminder: keep contexts specification-only (no implementation detail)

The model output must clearly separate aligned vs not-aligned items.

### Phase 5: Return Report (No File Writes)

Return a concise report in this structure:

```markdown
# Context Sync With Code Report

## Change Range Used
- <range expression>

## Relevant Paths
- <path>

## Aligned Contexts
- <context_id> - <file path> - aligned

## Contexts Requiring Updates
### <context_id> - <file path>
- Proposed Next Action: <description> | `<test_name>`
- Reason: <observed implementation change>

## New Context Candidates
- <project/feature>: <desired outcome inferred from code changes>

## Project/Feature Index Updates
### <index path>
- Proposed addition/update: <what to change>
- Reason: <observed implementation change>
```

### Phase 6: Update Checkpoint

After a successful analysis pass, update `.nexus/config.json`:

- `context_sync.code.last_synced_commit = HEAD`
- `context_sync.code.synced_at = current UTC timestamp`

### Phase 7: Present Follow-Up Choices With `question`

After the report, call the `question` tool once with actionable follow-up options.

Requirements:
- Put the recommended next step first and label it `(Recommended)`.
- Keep `custom` enabled so user can type their own next action.
- Use `multiple: false`.

Suggested options:
1. Apply all context/index updates from this report (Recommended)
2. Apply only contexts marked "requiring updates"
3. Create only new context candidates
4. Show patch preview first
5. Skip changes and keep checkpoint only

## Important Notes

- This command is implementation-alignment focused, not conversation-alignment focused.
- Prefer objective evidence from changed files over assumptions.
- If nothing needs updating, return an explicit no-change report.
