use crate::adapters::orchestration_store::TimelineFilter;

use super::temp_store;

#[test]
fn timeline_filter_rejects_conflicting_run_id_and_context() {
    let store = temp_store();
    let run_id = store
        .create_run("default", "ORC_009", "ctx.md", "fp", false, None, None)
        .expect("run");

    let err = store
        .query_timeline(&TimelineFilter {
            run_id: Some(run_id),
            context_id: Some("DIFFERENT".to_string()),
            context_file: None,
            pipeline_name: None,
        })
        .expect_err("should fail");
    assert!(err
        .to_string()
        .contains("Unsupported filter combination: run_id"));
}

#[test]
fn timeline_filter_rejects_conflicting_context_id_and_context_file() {
    let store = temp_store();
    let run_id = store
        .create_run(
            "default",
            "ORC_009",
            ".nexus/context/nexus-cli/orchestration/ORC_009.md",
            "fp",
            false,
            None,
            None,
        )
        .expect("run");
    store
        .finish_run(run_id, "success", None)
        .expect("finish run");

    let err = store
        .query_timeline(&TimelineFilter {
            run_id: None,
            context_id: Some("ORC_009".to_string()),
            context_file: Some(".nexus/context/cdd-web-ui/workspace/CWB_001.md".to_string()),
            pipeline_name: None,
        })
        .expect_err("should fail");
    assert!(err
        .to_string()
        .contains("Unsupported filter combination: context_id"));
}
