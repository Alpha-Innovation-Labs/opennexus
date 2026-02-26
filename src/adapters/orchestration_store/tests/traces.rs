use crate::adapters::orchestration_store::{StepAttemptPersistence, TraceRecordInput};

use super::temp_store;

#[test]
fn structured_trace_query_returns_prompt_response_and_linkage() {
    let store = temp_store();
    let run_id = store
        .create_run("default", "ORC_007", "ctx.md", "fp", false, None, None)
        .expect("create run");

    let step_attempt_id = store
        .persist_step_attempt_with_traces(&StepAttemptPersistence {
            run_id,
            step_id: "coder_iteration".to_string(),
            attempt_index: 1,
            status: "success".to_string(),
            details: "ok".to_string(),
            terminal_reason: None,
            step_input_json: "{}".to_string(),
            step_output_json: "{}".to_string(),
            traces: vec![TraceRecordInput {
                step_id: "coder_iteration".to_string(),
                attempt_index: 1,
                model: "opencode/default".to_string(),
                prompt: "prompt payload".to_string(),
                response: "response payload".to_string(),
                status: "success".to_string(),
                latency_ms: 14,
                token_usage: 99,
                terminal_status: "success".to_string(),
                artifact_refs_json: "[\"artifact://a\"]".to_string(),
            }],
        })
        .expect("persist trace");

    let traces = store
        .query_traces_for_run(run_id)
        .expect("structured trace query");
    assert_eq!(traces.len(), 1);
    assert_eq!(traces[0].step_attempt_id, Some(step_attempt_id));
    assert_eq!(traces[0].prompt_payload, "prompt payload");
    assert_eq!(traces[0].response_payload, "response payload");
    assert_eq!(traces[0].token_usage, 99);
    assert_eq!(traces[0].artifact_refs, vec!["artifact://a".to_string()]);
}
