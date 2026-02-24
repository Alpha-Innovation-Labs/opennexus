use anyhow::{bail, Context, Result};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant};

use super::parser::parse_context_file;
use super::reporting::{log_stage_result, log_stage_start, print_terminal_summary};
use super::rules::{discover_rule_files, select_rule_file};
use super::test_discovery::{discover_tests_from_runner, missing_tests};
use crate::adapters::agents::build_invocation;
use crate::core::context::model::{
    ContextImplementOptions, ContextLoopOutcome, ContextParseResult,
};
use crate::core::ralph::model::AgentType;

pub(crate) fn run_context_implement(options: &ContextImplementOptions) -> Result<()> {
    let started = Instant::now();

    log_stage_start("context_loader", 0, &options.context_file);
    let parsed = parse_context_file(&options.context_file)?;
    log_stage_result(
        "context_loader",
        true,
        &format!(
            "context_id={}, tests={}",
            parsed.context_id,
            parsed.tests.len()
        ),
    );

    let discovered_rule_files = discover_rule_files(Path::new(".nexus/ai_harness/rules"))?;
    println!("Discovered coding rule files:");
    if discovered_rule_files.is_empty() {
        println!("- (none)");
    } else {
        for file in &discovered_rule_files {
            println!("- {}", file.display());
        }
    }

    let selected_rule = select_rule_file(&discovered_rule_files, options.rule_file.as_deref())?;
    if let Some(rule) = &selected_rule {
        println!("Selected coding rule: {}", rule.display());
    } else {
        println!("No coding rule selected (none discovered). Continuing.");
    }

    log_stage_start("test_generator", 0, &options.context_file);
    let generated_file = generate_test_scaffold(&options.context_file, &parsed)?;
    log_stage_result(
        "test_generator",
        true,
        &format!("generated={}", generated_file.display()),
    );

    log_stage_start("test_verifier", 0, &options.context_file);
    let discovered = discover_tests_from_runner()?;
    let missing = missing_tests(&parsed.tests, &discovered);
    if !missing.is_empty() {
        log_stage_result(
            "test_verifier",
            false,
            &format!("missing_discovery={}", missing.join(", ")),
        );
        bail!(
            "Generated tests are not discoverable: {}. Check test naming and repository discovery rules before coding.",
            missing.join(", ")
        );
    }
    log_stage_result("test_verifier", true, "all generated tests discoverable");

    let timeout = Duration::from_secs(options.timeout_seconds);
    for iteration in 1..=options.max_iterations {
        if started.elapsed() >= timeout {
            print_terminal_summary(
                ContextLoopOutcome::TimeoutReached,
                iteration.saturating_sub(1),
                &parsed.tests,
            );
            return Ok(());
        }

        log_stage_start("coder", iteration, &options.context_file);
        let coder_prompt = build_coder_prompt(
            &options.context_file,
            &parsed.tests,
            selected_rule.as_deref(),
            iteration,
            options.max_iterations,
        )?;
        run_coder_stage(&coder_prompt).with_context(|| {
            "coder stage failed. Remediation: ensure OpenCode is installed/authenticated and retry; use --rule-file to disambiguate coding constraints if needed."
        })?;
        log_stage_result("coder", true, "agent invocation completed");

        log_stage_start("implementation_validator", iteration, &options.context_file);
        match validate_generated_tests(&parsed.tests) {
            Ok(true) => {
                log_stage_result("implementation_validator", true, "all target tests passed");
                print_terminal_summary(ContextLoopOutcome::Success, iteration, &parsed.tests);
                return Ok(());
            }
            Ok(false) => {
                log_stage_result(
                    "implementation_validator",
                    false,
                    "tests still failing; continuing loop",
                );
            }
            Err(err) => {
                log_stage_result(
                    "implementation_validator",
                    false,
                    "unable to execute test validation",
                );
                return Err(err).context(
                    "implementation_validator stage failed. Remediation: run `cargo test` locally to inspect compilation/runtime failures and retry.",
                );
            }
        }
    }

    print_terminal_summary(
        ContextLoopOutcome::MaxIterationsReached,
        options.max_iterations,
        &parsed.tests,
    );
    Ok(())
}

fn run_coder_stage(prompt: &str) -> Result<()> {
    let invocation = build_invocation(AgentType::Opencode, prompt, "", true, &[], false, None);
    let output = Command::new(&invocation.command)
        .args(&invocation.args)
        .envs(&invocation.env)
        .output()
        .with_context(|| {
            format!(
                "Failed to execute coder agent command '{}'.",
                invocation.command
            )
        })?;

    if output.status.success() {
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    bail!(
        "Coder agent exited with status {}. stderr: {}",
        output.status.code().unwrap_or(-1),
        stderr.trim()
    )
}

fn validate_generated_tests(test_ids: &[String]) -> Result<bool> {
    let mut all_passed = true;
    for test_id in test_ids {
        let status = Command::new("cargo")
            .args(["test", test_id, "--", "--exact"])
            .status()
            .with_context(|| format!("Failed to run cargo test for '{}'.", test_id))?;
        if !status.success() {
            all_passed = false;
        }
    }
    Ok(all_passed)
}

fn build_coder_prompt(
    context_file: &Path,
    test_ids: &[String],
    selected_rule: Option<&Path>,
    iteration: usize,
    max_iterations: usize,
) -> Result<String> {
    let tests_block = test_ids.join("\n- ");
    let rule_block = if let Some(rule_path) = selected_rule {
        let rule_text = fs::read_to_string(rule_path).with_context(|| {
            format!(
                "Unable to read selected rule file '{}'.",
                rule_path.display()
            )
        })?;
        format!(
            "Hard constraint: you MUST follow this rule file without exception:\nPath: {}\n\n{}",
            rule_path.display(),
            rule_text
        )
    } else {
        "No coding rule file selected; proceed with repository conventions.".to_string()
    };

    Ok(format!(
        "Context-driven implementation iteration {}/{}\n\nContext file: {}\n\nTarget tests:\n- {}\n\n{}\n\nImplement code changes that satisfy all target tests. Keep edits minimal, deterministic, and limited to relevant files.",
        iteration,
        max_iterations,
        context_file.display(),
        tests_block,
        rule_block,
    ))
}

fn generate_test_scaffold(context_file: &Path, parsed: &ContextParseResult) -> Result<PathBuf> {
    fs::create_dir_all("tests").context("Failed to create tests directory.")?;

    let stem = context_file
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("context")
        .to_ascii_lowercase()
        .replace('-', "_");
    let target = Path::new("tests").join(format!("context_generated_{}.rs", stem));

    let existing = if target.exists() {
        fs::read_to_string(&target).with_context(|| {
            format!(
                "Unable to read existing test scaffold '{}'.",
                target.display()
            )
        })?
    } else {
        String::new()
    };

    let mut additions = String::new();
    for test_id in &parsed.tests {
        let signature = format!("fn {}()", test_id);
        if existing.contains(&signature) {
            continue;
        }
        additions.push_str("#[test]\n");
        additions.push_str(&format!("fn {}() {{\n", test_id));
        additions.push_str(
            "    panic!(\"Generated CDD scaffold test. Implement behavior to replace this placeholder.\");\n",
        );
        additions.push_str("}\n\n");
    }

    if !target.exists() {
        let mut initial = String::from("#![allow(clippy::panic)]\n\n");
        initial.push_str("// Generated by `opennexus context implement`.\n\n");
        initial.push_str(&additions);
        fs::write(&target, initial).with_context(|| {
            format!(
                "Unable to write generated test scaffold '{}'.",
                target.display()
            )
        })?;
    } else if !additions.is_empty() {
        let mut updated = existing;
        if !updated.ends_with('\n') {
            updated.push('\n');
        }
        updated.push_str(&additions);
        fs::write(&target, updated).with_context(|| {
            format!(
                "Unable to update generated test scaffold '{}'.",
                target.display()
            )
        })?;
    }

    Ok(target)
}
