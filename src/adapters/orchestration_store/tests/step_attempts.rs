use crate::adapters::orchestration_store::{StepAttemptPersistence, TraceRecordInput};

use super::temp_store;

#[test]
fn persists_step_attempt_with_io_and_trace_transactionally() {
    let store = temp_store();
    let run_id = store
        .create_run("default", "ORC_003", "ctx.md", "fp", false, None, None)
        .expect("create run");

    let step_attempt_id = store
        .persist_step_attempt_with_traces(&StepAttemptPersistence {
            run_id,
            step_id: "parse_context".to_string(),
            attempt_index: 1,
            status: "success".to_string(),
            details: "ok".to_string(),
            terminal_reason: None,
            step_input_json: "{\"requires\":[]}".to_string(),
            step_output_json: "{\"provides\":[\"parsed_context\"]}".to_string(),
            traces: vec![TraceRecordInput {
                step_id: "parse_context".to_string(),
                attempt_index: 1,
                model: "opencode/default".to_string(),
                prompt: "hello".to_string(),
                response: "world".to_string(),
                status: "success".to_string(),
                latency_ms: 5,
                token_usage: 42,
                terminal_status: "success".to_string(),
                artifact_refs_json: "[]".to_string(),
            }],
        })
        .expect("persist step attempt");
    assert!(step_attempt_id > 0);

    let traces = store.list_traces_for_run(run_id).expect("list traces");
    assert_eq!(traces.len(), 1);
    assert_eq!(traces[0].1, "parse_context");
    assert_eq!(traces[0].4, 5);
    assert_eq!(traces[0].5, 42);
}
