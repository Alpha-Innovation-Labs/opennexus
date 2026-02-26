use super::OrchestrationStore;

mod dependencies;
mod next_actions;
mod runs;
mod step_attempts;
mod timeline;
mod traces;

fn temp_store() -> OrchestrationStore {
    let nonce = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("unix epoch")
        .as_nanos();
    let db_path = std::env::temp_dir().join(format!(
        "orchestration-store-test-{}-{}.sqlite",
        std::process::id(),
        nonce
    ));
    let _ = std::fs::remove_file(&db_path);
    OrchestrationStore::open(&db_path).expect("store open")
}
