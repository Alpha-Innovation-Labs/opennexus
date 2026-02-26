use crate::core::context::model::ContextNextAction;

use super::temp_store;

#[test]
fn reconciles_next_actions_into_pending_and_cancelled() {
    let store = temp_store();
    let (first_run, _) = store
        .create_run_with_snapshot_and_actions(
            "default",
            "ORC_006",
            "ctx.md",
            "fp1",
            false,
            None,
            None,
            "h1",
            "{}",
            &[ContextNextAction {
                description: "one".to_string(),
                test_id: "action_one".to_string(),
            }],
        )
        .expect("first run");
    store
        .finish_run(first_run, "success", None)
        .expect("finish first run");

    let (_, summary) = store
        .create_run_with_snapshot_and_actions(
            "default",
            "ORC_006",
            "ctx.md",
            "fp2",
            false,
            None,
            None,
            "h2",
            "{}",
            &[ContextNextAction {
                description: "two".to_string(),
                test_id: "action_two".to_string(),
            }],
        )
        .expect("second run");
    assert_eq!(summary.added_pending, 1);
    assert_eq!(summary.removed_cancelled, 1);
}
