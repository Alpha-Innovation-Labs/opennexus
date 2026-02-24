use std::path::Path;

use crate::core::context::model::{BackfillContextResult, ContextLoopOutcome};

#[derive(Debug, Default)]
pub(crate) struct AggregateBackfillCounts {
    pub implemented: usize,
    pub failed: usize,
    pub missing: usize,
}

pub(crate) fn aggregate_backfill_counts(
    context_results: &[BackfillContextResult],
) -> AggregateBackfillCounts {
    let mut aggregate = AggregateBackfillCounts::default();
    for result in context_results {
        aggregate.implemented += result.implemented_count();
        aggregate.failed += result.failed_count();
        aggregate.missing += result.missing_count();
    }
    aggregate
}

pub(crate) fn format_partial_audit_errors(
    parse_errors: &[String],
    execution_errors: &[String],
) -> Vec<String> {
    let mut all_errors = Vec::<String>::new();
    all_errors.extend(parse_errors.iter().map(|err| format!("- parse: {}", err)));
    all_errors.extend(
        execution_errors
            .iter()
            .map(|err| format!("- execute: {}", err)),
    );
    all_errors
}

pub(crate) fn print_backfill_context_summary(result: &BackfillContextResult) {
    println!("Context file: {}", result.context_file.display());
    println!("Context id: {}", result.context_id);
    for task in &result.tasks {
        println!(
            "- {:<11} {}",
            task.status.as_str().to_uppercase(),
            task.test_id
        );
    }
    println!(
        "Backfill summary: implemented={}, failed={}, missing={}",
        result.implemented_count(),
        result.failed_count(),
        result.missing_count(),
    );
}

pub(crate) fn print_backfill_global_summary(
    contexts: usize,
    implemented: usize,
    failed: usize,
    missing: usize,
) {
    println!("Contexts audited: {}", contexts);
    println!(
        "Aggregate summary: implemented={}, failed={}, missing={}",
        implemented, failed, missing
    );
}

pub(crate) fn log_stage_start(stage: &str, iteration: usize, context_file: &Path) {
    println!(
        "[stage:start] stage={} iteration={} context_file={}",
        stage,
        iteration,
        context_file.display()
    );
}

pub(crate) fn log_stage_result(stage: &str, success: bool, details: &str) {
    println!(
        "[stage:result] stage={} status={} details={}",
        stage,
        if success { "ok" } else { "failed" },
        details
    );
}

pub(crate) fn print_terminal_summary(
    outcome: ContextLoopOutcome,
    iteration: usize,
    tests: &[String],
) {
    println!("Terminal reason: {:?}", outcome);
    println!("Final iteration: {}", iteration);
    println!("Tracked tests: {}", tests.join(", "));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::context::model::{BackfillTaskResult, ContextTaskStatus};
    use std::path::PathBuf;

    #[test]
    fn context_backfill_all_reports_aggregate_task_state_counts() {
        let results = vec![BackfillContextResult {
            context_id: "CDD_400".to_string(),
            context_file: PathBuf::from("x.md"),
            tasks: vec![
                BackfillTaskResult {
                    test_id: "task_1".to_string(),
                    status: ContextTaskStatus::Implemented,
                    details: None,
                },
                BackfillTaskResult {
                    test_id: "task_2".to_string(),
                    status: ContextTaskStatus::Failed,
                    details: None,
                },
                BackfillTaskResult {
                    test_id: "task_3".to_string(),
                    status: ContextTaskStatus::Missing,
                    details: None,
                },
            ],
        }];
        let aggregate = aggregate_backfill_counts(&results);
        assert_eq!(aggregate.implemented, 1);
        assert_eq!(aggregate.failed, 1);
        assert_eq!(aggregate.missing, 1);
    }

    #[test]
    fn context_backfill_all_reports_actionable_partial_audit_errors() {
        let errors = format_partial_audit_errors(
            &["a.md: parse failed".to_string()],
            &["b.md: execution failed".to_string()],
        );
        assert_eq!(errors.len(), 2);
        assert!(errors[0].contains("parse"));
        assert!(errors[1].contains("execute"));
    }
}
