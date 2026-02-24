use rusqlite::Connection;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tempfile::tempdir;

fn init_sample_project(root: &Path) {
    let status = Command::new("cargo")
        .args(["init", "--lib", "--name", "sample_context_project", "."])
        .current_dir(root)
        .status()
        .expect("failed to run cargo init");
    assert!(status.success(), "cargo init did not succeed");
}

fn write_context_file(root: &Path, file_name: &str, test_ids: &[&str]) -> PathBuf {
    let context_dir = root.join(".nexus/context/sample/cdd");
    fs::create_dir_all(&context_dir).expect("create context dir");

    let mut rows = String::new();
    for test_id in test_ids {
        rows.push_str(&format!("| Implement behavior | `{}` |\n", test_id));
    }

    let content = format!(
        "---\ncontext_id: CDD_900\ntitle: Sample Context\nproject: sample\nfeature: cdd\ncreated: \"2026-02-23\"\n---\n\n# CDD_900: Sample Context\n\n## Desired Outcome\n\nSample desired outcome.\n\n## Next Actions\n\n| Description | Test |\n|-------------|------|\n{}",
        rows
    );

    let path = context_dir.join(file_name);
    fs::write(&path, content).expect("write context file");
    path
}

#[test]
fn sample_project_context_implement_generates_tests() {
    let temp = tempdir().expect("tempdir");
    let root = temp.path();
    init_sample_project(root);

    let context_file = write_context_file(
        root,
        "CDD_900-sample-implement.md",
        &["sample_generated_test"],
    );

    let status = Command::new(env!("CARGO_BIN_EXE_opennexus"))
        .args([
            "context",
            "implement",
            "--context-file",
            &context_file.display().to_string(),
            "--max-iterations",
            "0",
            "--timeout-seconds",
            "30",
        ])
        .current_dir(root)
        .status()
        .expect("failed to run opennexus context implement");
    assert!(status.success(), "context implement should succeed");

    let generated = root.join("tests/context_generated_cdd_900_sample_implement.rs");
    assert!(generated.exists(), "generated test scaffold should exist");

    let generated_content = fs::read_to_string(generated).expect("read generated file");
    assert!(generated_content.contains("fn sample_generated_test()"));
}

#[test]
fn sample_project_context_backfill_persists_successful_results() {
    let temp = tempdir().expect("tempdir");
    let root = temp.path();
    init_sample_project(root);

    let tests_dir = root.join("tests");
    fs::create_dir_all(&tests_dir).expect("create tests dir");
    fs::write(
        tests_dir.join("sample_backfill.rs"),
        "#[test]\nfn sample_backfill_passes() { assert_eq!(1 + 1, 2); }\n",
    )
    .expect("write sample backfill test");

    let context_file = write_context_file(
        root,
        "CDD_901-sample-backfill.md",
        &["sample_backfill_passes"],
    );

    let status = Command::new(env!("CARGO_BIN_EXE_opennexus"))
        .args([
            "context",
            "backfill",
            "--context-file",
            &context_file.display().to_string(),
        ])
        .current_dir(root)
        .status()
        .expect("failed to run opennexus context backfill");
    assert!(status.success(), "context backfill should succeed");

    let db_path = root.join(".nexus/context/observability.sqlite");
    assert!(db_path.exists(), "observability sqlite should exist");

    let connection = Connection::open(db_path).expect("open sqlite");
    let run_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM cdd_runs", [], |row| row.get(0))
        .expect("count runs");
    assert!(run_count >= 1, "backfill should persist at least one run");
}
