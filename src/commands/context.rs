use anyhow::Result;
use std::path::PathBuf;

use crate::app::{
    run_context_backfill_app, run_context_implement_app, run_context_test_status_app,
};
use crate::core::context::model::{
    ContextBackfillOptions, ContextImplementOptions, ContextTestStatusOptions,
};

pub fn run_context_implement(
    context_file: &str,
    max_iterations: usize,
    timeout_seconds: u64,
    rule_file: Option<&str>,
    test_command: Option<&str>,
    test_discovery_command: Option<&str>,
) -> Result<()> {
    let options = ContextImplementOptions {
        context_file: PathBuf::from(context_file),
        max_iterations,
        timeout_seconds,
        rule_file: rule_file.map(str::to_string),
        test_command: test_command.map(str::to_string),
        test_discovery_command: test_discovery_command.map(str::to_string),
    };
    run_context_implement_app(&options)
}

pub fn run_context_test_status(context_file: &str, command_name: Option<&str>) -> Result<()> {
    let options = ContextTestStatusOptions {
        context_file: PathBuf::from(context_file),
        command_name: command_name.unwrap_or("test-status").to_string(),
    };
    run_context_test_status_app(&options)
}

pub fn run_context_backfill(context_file: Option<&str>, all: bool) -> Result<()> {
    let options = ContextBackfillOptions {
        context_file: context_file.map(PathBuf::from),
        all,
    };
    run_context_backfill_app(&options)
}
