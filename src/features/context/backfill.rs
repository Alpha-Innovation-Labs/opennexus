use anyhow::{bail, Context, Result};
use std::collections::BTreeSet;
use std::path::Path;
use std::process::Command;

use super::parser::parse_context_file;
use super::reporting::{
    aggregate_backfill_counts, format_partial_audit_errors, print_backfill_context_summary,
    print_backfill_global_summary,
};
use super::scan::scan_valid_context_specs;
use super::test_discovery::{discover_tests_from_runner, is_test_discovered};
use crate::adapters::context_observability::ContextObservabilityStore;
use crate::core::context::model::{
    BackfillContextResult, BackfillTaskResult, ContextBackfillOptions, ContextTaskStatus,
};

pub(crate) fn run_context_backfill(options: &ContextBackfillOptions) -> Result<()> {
    if options.all {
        return run_context_backfill_all();
    }

    let context_file = options.context_file.as_ref().ok_or_else(|| {
        anyhow::anyhow!("Backfill requires either --context-file <path> or --all.")
    })?;

    let store = ContextObservabilityStore::open_default().context(
        "Backfill could not open observability storage. Remediation: ensure .nexus/context is writable and retry.",
    )?;
    let discovered = discover_tests_from_runner().context(
        "Backfill test discovery failed. Remediation: run `cargo test -- --list` locally and resolve compiler/test harness issues.",
    )?;

    let result = run_backfill_for_context(context_file, &discovered)?;
    store.persist_backfill_context_result(&result).context(
        "Backfill could not persist run results. Remediation: verify SQLite file permissions under .nexus/context/ and retry.",
    )?;

    print_backfill_context_summary(&result);

    if result.failed_count() > 0 || result.missing_count() > 0 {
        bail!(
            "Backfill finished with incomplete task states for context '{}': implemented={}, failed={}, missing={}. Remediation: implement missing behavior and rerun `opennexus context backfill --context-file {}`.",
            result.context_id,
            result.implemented_count(),
            result.failed_count(),
            result.missing_count(),
            result.context_file.display()
        );
    }

    Ok(())
}

fn run_context_backfill_all() -> Result<()> {
    let discovered = discover_tests_from_runner().context(
        "Global backfill test discovery failed. Remediation: run `cargo test -- --list` locally and resolve compiler/test harness issues.",
    )?;
    let store = ContextObservabilityStore::open_default().context(
        "Global backfill could not open observability storage. Remediation: ensure .nexus/context is writable and retry.",
    )?;

    let scan = scan_valid_context_specs(Path::new(".nexus/context"))?;
    if scan.valid_context_files.is_empty() {
        bail!(
            "Global backfill found no valid context specs under .nexus/context/. Remediation: add context files with YAML frontmatter and a Next Actions table."
        );
    }

    let mut context_results = Vec::<BackfillContextResult>::new();
    let mut execution_errors = Vec::<String>::new();

    for context_file in &scan.valid_context_files {
        match run_backfill_for_context(context_file, &discovered) {
            Ok(result) => {
                if let Err(err) = store.persist_backfill_context_result(&result) {
                    execution_errors.push(format!(
                        "{}: failed to persist backfill results: {}",
                        context_file.display(),
                        err
                    ));
                }
                context_results.push(result);
            }
            Err(err) => execution_errors.push(format!(
                "{}: failed to execute context backfill: {}",
                context_file.display(),
                err
            )),
        }
    }

    let aggregate = aggregate_backfill_counts(&context_results);
    print_backfill_global_summary(
        scan.valid_context_files.len(),
        aggregate.implemented,
        aggregate.failed,
        aggregate.missing,
    );

    let partial_errors = format_partial_audit_errors(&scan.parse_errors, &execution_errors);
    if !partial_errors.is_empty() {
        bail!(
            "Global backfill completed with partial-audit errors:\n{}\nRemediation: fix invalid context specs and execution failures, then rerun `opennexus context backfill --all`.",
            partial_errors.join("\n")
        );
    }

    if aggregate.failed > 0 || aggregate.missing > 0 {
        bail!(
            "Global backfill detected incomplete task states: implemented={}, failed={}, missing={}. Remediation: address failing/missing tests and rerun `opennexus context backfill --all`.",
            aggregate.implemented,
            aggregate.failed,
            aggregate.missing,
        );
    }

    Ok(())
}

fn run_backfill_for_context(
    context_file: &Path,
    discovered: &BTreeSet<String>,
) -> Result<BackfillContextResult> {
    let parsed = parse_context_file(context_file).with_context(|| {
        format!(
            "Backfill failed to parse context '{}'. Remediation: verify frontmatter and Next Actions table format.",
            context_file.display()
        )
    })?;

    let mut tasks = Vec::<BackfillTaskResult>::new();
    for test_id in &parsed.tests {
        let task = run_backfill_task(test_id, discovered)?;
        tasks.push(task);
    }

    Ok(BackfillContextResult {
        context_id: parsed.context_id,
        context_file: context_file.to_path_buf(),
        tasks,
    })
}

fn run_backfill_task(test_id: &str, discovered: &BTreeSet<String>) -> Result<BackfillTaskResult> {
    if !is_test_discovered(test_id, discovered) {
        return Ok(BackfillTaskResult {
            test_id: test_id.to_string(),
            status: classify_backfill_task_status(false, None),
            details: Some(
                "test id was not discovered by `cargo test -- --list`; verify naming and compilation"
                    .to_string(),
            ),
        });
    }

    let status = Command::new("cargo")
        .args(["test", test_id, "--", "--exact"])
        .status()
        .with_context(|| {
            format!(
                "Backfill could not execute test '{}'. Remediation: run `cargo test {} -- --exact` locally.",
                test_id, test_id
            )
        })?;

    if status.success() {
        return Ok(BackfillTaskResult {
            test_id: test_id.to_string(),
            status: classify_backfill_task_status(true, Some(true)),
            details: None,
        });
    }

    Ok(BackfillTaskResult {
        test_id: test_id.to_string(),
        status: classify_backfill_task_status(true, Some(false)),
        details: Some(format!(
            "`cargo test {} -- --exact` exited with code {}",
            test_id,
            status.code().unwrap_or(-1)
        )),
    })
}

fn classify_backfill_task_status(
    discovered: bool,
    test_succeeded: Option<bool>,
) -> ContextTaskStatus {
    if !discovered {
        return ContextTaskStatus::Missing;
    }
    match test_succeeded {
        Some(true) => ContextTaskStatus::Implemented,
        Some(false) | None => ContextTaskStatus::Failed,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;
    use std::path::PathBuf;
    use tempfile::tempdir;

    #[test]
    fn context_backfill_marks_missing_tests_when_not_discoverable() {
        let discovered = BTreeSet::from(["suite::known_test".to_string()]);
        let task = run_backfill_task("missing_test", &discovered).expect("task should evaluate");
        assert_eq!(task.status, ContextTaskStatus::Missing);
    }

    #[test]
    fn context_backfill_classifies_task_state_from_test_results() {
        assert_eq!(
            classify_backfill_task_status(true, Some(true)),
            ContextTaskStatus::Implemented
        );
        assert_eq!(
            classify_backfill_task_status(true, Some(false)),
            ContextTaskStatus::Failed
        );
    }

    #[test]
    fn context_backfill_reports_actionable_discovery_or_execution_errors() {
        let err = scan_valid_context_specs(Path::new(".nexus/does-not-exist"))
            .expect_err("scan should fail");
        assert!(err
            .to_string()
            .contains("Global backfill requires '.nexus/context/' to exist"));
    }

    #[test]
    fn context_backfill_all_persists_per_context_results() {
        let temp = tempdir().expect("tempdir");
        let db_path = temp.path().join("observability.sqlite");
        let store = ContextObservabilityStore::open(&db_path).expect("store should open");

        let first = BackfillContextResult {
            context_id: "CDD_300".to_string(),
            context_file: PathBuf::from("a.md"),
            tasks: vec![BackfillTaskResult {
                test_id: "task_a".to_string(),
                status: ContextTaskStatus::Implemented,
                details: None,
            }],
        };
        let second = BackfillContextResult {
            context_id: "CDD_301".to_string(),
            context_file: PathBuf::from("b.md"),
            tasks: vec![BackfillTaskResult {
                test_id: "task_b".to_string(),
                status: ContextTaskStatus::Missing,
                details: None,
            }],
        };

        store
            .persist_backfill_context_result(&first)
            .expect("persist first");
        store
            .persist_backfill_context_result(&second)
            .expect("persist second");

        let verify = Connection::open(db_path).expect("verify connection");
        let run_count: i64 = verify
            .query_row("SELECT COUNT(*) FROM cdd_runs", [], |row| row.get(0))
            .expect("query run count");
        assert_eq!(run_count, 2);
    }
}
