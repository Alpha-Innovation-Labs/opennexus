use super::temp_store;

#[test]
fn resolves_project_reference_and_finds_latest_success() {
    let store = temp_store();
    let run_id = store
        .create_run(
            "default",
            "ORC_007",
            ".nexus/context/nexus-cli/orchestration/ORC_007.md",
            "fp",
            false,
            None,
            None,
        )
        .expect("run");
    store
        .finish_run(run_id, "success", None)
        .expect("finish run");

    let resolved = store
        .resolve_project_reference("nexus")
        .expect("resolve project shorthand");
    assert_eq!(resolved, "nexus-cli");
    assert!(store
        .latest_success_for_project("nexus-cli")
        .expect("query project")
        .is_some());
}

#[test]
fn project_reference_reports_actionable_ambiguous_error() {
    let store = temp_store();
    let run_a = store
        .create_run(
            "default",
            "CWB_001",
            ".nexus/context/cdd-web-ui/workspace/CWB_001.md",
            "fp-a",
            false,
            None,
            None,
        )
        .expect("run a");
    store.finish_run(run_a, "success", None).expect("finish a");
    let run_b = store
        .create_run(
            "default",
            "CORE_001",
            ".nexus/context/cdd-web-core/runtime/CORE_001.md",
            "fp-b",
            false,
            None,
            None,
        )
        .expect("run b");
    store.finish_run(run_b, "success", None).expect("finish b");

    let err = store
        .resolve_project_reference("cdd-web")
        .expect_err("should be ambiguous");
    assert!(err
        .to_string()
        .contains("Ambiguous project dependency 'cdd-web'"));
}
