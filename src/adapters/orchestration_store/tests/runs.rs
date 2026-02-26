use super::temp_store;

#[test]
fn stop_active_run_marks_terminal_stopped_state() {
    let store = temp_store();
    let run_id = store
        .create_run(
            "default",
            "ORC_STOP",
            "ctx.md",
            "fp",
            false,
            None,
            Some(12345),
        )
        .expect("create run");

    let stopped = store
        .stop_active_run_for_context("ctx.md", None, "stopped_by_operator")
        .expect("stop active run")
        .expect("run should be found");
    assert_eq!(stopped.0, run_id);

    let run = store
        .get_run_by_id(run_id)
        .expect("get run")
        .expect("run exists");
    assert_eq!(run.status, "stopped");
    assert_eq!(run.terminal_reason.as_deref(), Some("stopped_by_operator"));
}

#[test]
fn stop_active_run_returns_none_when_no_active_run() {
    let store = temp_store();
    let stopped = store
        .stop_active_run_for_context("ctx.md", None, "stopped_by_operator")
        .expect("query should succeed");
    assert!(stopped.is_none());
}

#[test]
fn hard_restart_lineage_sets_supersedes_run_id() {
    let store = temp_store();
    let first = store
        .create_run(
            "default",
            "ORC_RESTART",
            "ctx.md",
            "fp-a",
            false,
            None,
            Some(111),
        )
        .expect("first run");
    let _ = store
        .stop_active_run_for_context("ctx.md", None, "stopped_by_operator")
        .expect("stop first");

    let second = store
        .create_run(
            "default",
            "ORC_RESTART",
            "ctx.md",
            "fp-b",
            true,
            Some(first),
            Some(222),
        )
        .expect("second run");
    assert!(second > first);

    let mut stmt = store
        .connection
        .prepare("SELECT supersedes_run_id FROM orchestration_runs WHERE id=?1")
        .expect("prepare supersedes query");
    let supersedes: Option<i64> = stmt
        .query_row(rusqlite::params![second], |row| row.get(0))
        .expect("query supersedes");
    assert_eq!(supersedes, Some(first));
}
