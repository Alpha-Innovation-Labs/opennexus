---
context_id: CLI_014
title: Ralph Iteration Telemetry and Auto-Commit Parity
project: nexus-cli
feature: ralph
created: "2026-02-23"
---

# CLI_014: Ralph Iteration Telemetry and Auto-Commit Parity

## Desired Outcome

`opennexus ralph` emits iteration telemetry and persistence signals equivalent to the current Ralph CLI, including streamed output handling, heartbeats, compact tool summaries, history analytics, struggle indicators, file-change tracking, and optional Git auto-commit behavior.

## Next Actions

| Description | Test |
|-------------|------|
| Stream subprocess stdout/stderr in near real time and emit heartbeat lines during quiet intervals | `ralph_streaming_emits_idle_heartbeat_updates` |
| Provide compact per-iteration tool summary output when verbose tool streaming is disabled | `ralph_compact_tool_summary_reports_detected_tools` |
| Parse and display Claude stream-json payload text content in human-readable form | `ralph_claude_stream_json_lines_are_rendered_for_display` |
| Persist per-iteration history records with duration, tools used, exit code, errors, and completion flags | `ralph_persists_iteration_history_metrics` |
| Detect and surface struggle indicators for repeated no-progress and short-iteration patterns | `ralph_surfaces_struggle_indicators_after_threshold` |
| Track modified files by comparing pre/post iteration snapshots independent of commit state | `ralph_tracks_modified_files_by_snapshot_diff` |
| Auto-commit pending changes with iteration-scoped message when enabled | `ralph_auto_commit_creates_iteration_message` |
| Skip commit workflow entirely when `--no-commit` is set | `ralph_no_commit_mode_disables_auto_commit` |
