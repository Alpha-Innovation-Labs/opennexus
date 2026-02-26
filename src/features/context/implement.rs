use anyhow::{bail, Context, Result};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant};

use super::parser::parse_context_file;
use super::reporting::{log_stage_result, log_stage_start, print_terminal_summary};
use super::rules::{discover_rule_files, select_rule_file};
use super::test_runner::{
    discover_tests_with_plan, missing_tests, resolve_test_runner_plan, run_test_with_plan,
    run_test_with_plan_capture, TestRunnerPlan, ToolchainKind,
};
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

    let inferred_rule = infer_rule_request(
        &discovered_rule_files,
        &parsed,
        &options.context_file,
        options.rule_file.is_none(),
    )?;
    let selected_rule = select_rule_file(
        &discovered_rule_files,
        options.rule_file.as_deref().or(inferred_rule.as_deref()),
    )?;
    if let Some(rule) = &selected_rule {
        println!("Selected coding rule: {}", rule.display());
    } else {
        println!("No coding rule selected (none discovered). Continuing.");
    }

    let runner_plan = resolve_test_runner_plan(
        Path::new("."),
        &parsed,
        selected_rule.as_deref(),
        options.test_command.as_deref(),
        options.test_discovery_command.as_deref(),
    )?;
    println!(
        "Resolved test runner: source={}, toolchain={}, verify='{}'{}",
        runner_plan.source.as_str(),
        runner_plan.toolchain.as_str(),
        runner_plan.verify_command_template,
        runner_plan
            .discovery_command
            .as_ref()
            .map(|cmd| format!(", discovery='{}'", cmd))
            .unwrap_or_default(),
    );
    println!(
        "Resolver signals: {}",
        runner_plan.detected_signals.join(", ")
    );
    println!(
        "Resolver attempts: {}",
        runner_plan.attempted_sources.join("; ")
    );

    log_stage_start("test_generator", 0, &options.context_file);
    let generated_files =
        generate_test_scaffold(&options.context_file, &parsed, runner_plan.toolchain)?;
    log_stage_result(
        "test_generator",
        true,
        &format!(
            "generated_files={} output_dir={}",
            generated_files.len(),
            derive_context_test_output_dir(&options.context_file)
                .map(|path| path.display().to_string())
                .unwrap_or_else(|_| "tests".to_string())
        ),
    );

    log_stage_start("red_test_author", 0, &options.context_file);
    let red_prompt = build_red_test_author_prompt(
        &options.context_file,
        &parsed,
        selected_rule.as_deref(),
        &runner_plan,
        &generated_files,
    )?;
    run_agent_stage(&red_prompt).with_context(|| {
        "red_test_author stage failed. Remediation: ensure OpenCode is installed/authenticated and retry."
    })?;
    log_stage_result(
        "red_test_author",
        true,
        "agent generated test content for scaffold files",
    );

    log_stage_start("test_verifier", 0, &options.context_file);
    if let Some(discovered) = discover_tests_with_plan(&runner_plan)? {
        let missing = missing_tests(&parsed.tests, &discovered);
        if !missing.is_empty() {
            log_stage_result(
                "test_verifier",
                false,
                &format!("missing_discovery={}", missing.join(", ")),
            );
            bail!(
                "Generated tests are not discoverable: {}. Discovery command='{}'. Check test naming or pass --test-discovery-command explicitly.",
                missing.join(", "),
                runner_plan.discovery_command.as_deref().unwrap_or("<none>")
            );
        }
        log_stage_result("test_verifier", true, "all generated tests discoverable");
    } else {
        log_stage_result(
            "test_verifier",
            true,
            "discovery command not configured; proceeding to direct test execution",
        );
    }

    log_stage_start("red_test_verifier", 0, &options.context_file);
    verify_generated_tests_are_red(&generated_files, &runner_plan)?;
    log_stage_result(
        "red_test_verifier",
        true,
        "generated tests are failing as expected (red phase)",
    );

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
            &parsed,
            selected_rule.as_deref(),
            &runner_plan,
            iteration,
            options.max_iterations,
        )?;
        run_agent_stage(&coder_prompt).with_context(|| {
            "coder stage failed. Remediation: ensure OpenCode is installed/authenticated and retry; use --rule-file to disambiguate coding constraints if needed."
        })?;
        log_stage_result("coder", true, "agent invocation completed");

        log_stage_start("implementation_validator", iteration, &options.context_file);
        match validate_generated_tests(&parsed.tests, &runner_plan) {
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
                    "implementation_validator stage failed. Remediation: run the resolved test command manually and retry (or override with --test-command).",
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

fn infer_rule_request(
    discovered_rule_files: &[PathBuf],
    parsed: &ContextParseResult,
    context_file: &Path,
    allowed: bool,
) -> Result<Option<String>> {
    if !allowed || discovered_rule_files.len() <= 1 {
        return Ok(None);
    }

    let mut hints = Vec::<String>::new();
    if let Some(language) = &parsed.language {
        hints.push(language.to_ascii_lowercase());
    }
    if let Some(runner) = &parsed.test_runner {
        hints.push(runner.to_ascii_lowercase());
    }

    let content = fs::read_to_string(context_file)
        .unwrap_or_default()
        .to_ascii_lowercase();
    for (token, hint) in [
        ("python", "python"),
        ("pytest", "python"),
        ("uv run", "python"),
        ("rust", "rust"),
        ("cargo", "rust"),
        ("typescript", "nextjs"),
        ("javascript", "nextjs"),
        ("node", "nextjs"),
        ("npm", "nextjs"),
    ] {
        if content.contains(token) {
            hints.push(hint.to_string());
        }
    }

    if hints.is_empty() {
        return Ok(None);
    }

    for hint in hints {
        let candidates: Vec<String> = discovered_rule_files
            .iter()
            .filter(|path| {
                let normalized = path.to_string_lossy().to_ascii_lowercase();
                normalized.starts_with(&format!("{}/", hint)) || normalized.contains(&hint)
            })
            .map(|path| path.to_string_lossy().to_string())
            .collect();

        if candidates.len() == 1 {
            println!("Inferred rule hint from context: {}", candidates[0]);
            return Ok(Some(candidates[0].clone()));
        }
    }

    Ok(None)
}

fn run_agent_stage(prompt: &str) -> Result<()> {
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

#[derive(Debug, Clone)]
struct GeneratedTestFile {
    path: PathBuf,
    test_id: String,
    description: String,
}

fn build_red_test_author_prompt(
    context_file: &Path,
    parsed: &ContextParseResult,
    selected_rule: Option<&Path>,
    runner_plan: &TestRunnerPlan,
    generated_files: &[GeneratedTestFile],
) -> Result<String> {
    let files_block = generated_files
        .iter()
        .map(|file| {
            format!(
                "- file: {}\n  test_id: {}\n  intent: {}",
                file.path.display(),
                file.test_id,
                file.description
            )
        })
        .collect::<Vec<String>>()
        .join("\n");

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
        "You are generating RED tests only for context-driven development.\n\nContext file: {}\nContext id: {}\n\nGenerated scaffold files to fill (one test per file):\n{}\n\nTest command template: {}\n\nRules inspired by nexus-context-generate-red-tests:\n- Keep one test per file\n- Use test identifier exactly (already normalized)\n- Write test logic expected to fail for behavioral reasons\n- Do not produce syntax errors or collection/import failures\n- Do not implement production code\n- Do not modify files outside listed test files\n\n{}\n\nWrite concrete failing assertions in each listed file now.",
        context_file.display(),
        parsed.context_id,
        files_block,
        runner_plan.verify_command_template,
        rule_block,
    ))
}

fn verify_generated_tests_are_red(
    generated_files: &[GeneratedTestFile],
    plan: &TestRunnerPlan,
) -> Result<()> {
    for file in generated_files {
        let output = run_test_with_plan_capture(plan, &file.test_id).with_context(|| {
            format!(
                "Failed to execute generated red test '{}' using '{}'.",
                file.test_id, plan.verify_command_template
            )
        })?;
        if output.status.success() {
            bail!(
                "Red-phase violation: generated test '{}' unexpectedly passed. File: {}",
                file.test_id,
                file.path.display()
            );
        }

        let combined = format!(
            "{}\n{}",
            String::from_utf8_lossy(&output.stdout),
            String::from_utf8_lossy(&output.stderr)
        )
        .to_ascii_lowercase();

        if looks_like_syntax_or_collection_failure(&combined) {
            bail!(
                "Generated red test '{}' failed due to syntax/collection/runtime setup issue instead of expected behavioral assertion failure. File: {}",
                file.test_id,
                file.path.display()
            );
        }
    }
    Ok(())
}

fn looks_like_syntax_or_collection_failure(output: &str) -> bool {
    [
        "syntaxerror",
        "error collecting",
        "failed to import",
        "importerror",
        "nameerror",
        "module not found",
        "could not compile",
        "compilation failed",
        "error: could not compile",
        "parse error",
    ]
    .iter()
    .any(|needle| output.contains(needle))
}

fn validate_generated_tests(test_ids: &[String], plan: &TestRunnerPlan) -> Result<bool> {
    let mut all_passed = true;
    for test_id in test_ids {
        let passed = run_test_with_plan(plan, test_id).with_context(|| {
            format!(
                "Failed to execute resolved test command for '{}' (template='{}').",
                test_id, plan.verify_command_template
            )
        })?;
        if !passed {
            all_passed = false;
        }
    }
    Ok(all_passed)
}

fn build_coder_prompt(
    context_file: &Path,
    parsed: &ContextParseResult,
    selected_rule: Option<&Path>,
    runner_plan: &TestRunnerPlan,
    iteration: usize,
    max_iterations: usize,
) -> Result<String> {
    let tests_block = parsed.tests.join("\n- ");
    let next_actions_block = parsed
        .next_actions
        .iter()
        .map(|action| format!("- {} -> {}", action.description, action.test_id))
        .collect::<Vec<String>>()
        .join("\n");
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
        "Context-driven implementation iteration {}/{}\n\nContext file: {}\nContext id: {}\n\nNext Actions:\n{}\n\nTarget tests:\n- {}\n\nVerification command template: {}\n\n{}\n\nGuardrails:\n- Do not modify generated or existing tests in tests/\n- Implement production code only\n- Keep edits minimal, deterministic, and limited to relevant files\n\nImplement code changes that satisfy all target tests.",
        iteration,
        max_iterations,
        context_file.display(),
        parsed.context_id,
        next_actions_block,
        tests_block,
        runner_plan.verify_command_template,
        rule_block,
    ))
}

fn generate_test_scaffold(
    context_file: &Path,
    parsed: &ContextParseResult,
    toolchain: ToolchainKind,
) -> Result<Vec<GeneratedTestFile>> {
    let output_dir = derive_context_test_output_dir(context_file)?;
    fs::create_dir_all(&output_dir).with_context(|| {
        format!(
            "Failed to create test directory '{}'.",
            output_dir.display()
        )
    })?;

    let mut generated_files = Vec::<GeneratedTestFile>::new();
    for next_action in &parsed.next_actions {
        let test_id = &next_action.test_id;
        let file_base = sanitize_for_path(test_id);
        let target = match toolchain {
            ToolchainKind::Rust => output_dir.join(format!("{}.rs", file_base)),
            ToolchainKind::Python => output_dir.join(format!("test_{}.py", file_base)),
            ToolchainKind::Node => output_dir.join(format!("{}.test.js", file_base)),
            ToolchainKind::Unknown => output_dir.join(format!("{}.txt", file_base)),
        };

        if target.exists() {
            generated_files.push(GeneratedTestFile {
                path: target,
                test_id: test_id.to_string(),
                description: next_action.description.clone(),
            });
            continue;
        }

        let mut content = match toolchain {
            ToolchainKind::Rust => {
                "#![allow(clippy::panic)]\n\n// Generated by `opennexus context implement`.\n\n"
                    .to_string()
            }
            ToolchainKind::Python => {
                "# Generated by `opennexus context implement`.\n\n".to_string()
            }
            ToolchainKind::Node => "// Generated by `opennexus context implement`.\n\n".to_string(),
            ToolchainKind::Unknown => {
                "# Generated by `opennexus context implement`.\n\n".to_string()
            }
        };
        match toolchain {
            ToolchainKind::Python | ToolchainKind::Unknown => {
                content.push_str(&format!("# Intent: {}\n", next_action.description));
            }
            _ => {
                content.push_str(&format!("// Intent: {}\n", next_action.description));
            }
        }

        match toolchain {
            ToolchainKind::Rust => {
                content.push_str("#[test]\n");
                content.push_str(&format!("fn test_{}() {{\n", test_id));
                content.push_str(
                    "    panic!(\"Generated CDD scaffold test. Implement behavior to replace this placeholder.\");\n",
                );
                content.push_str("}\n");
            }
            ToolchainKind::Python => {
                content.push_str(&format!("def test_{}():\n", test_id));
                content.push_str(
                    "    raise AssertionError(\"Generated CDD scaffold test. Implement behavior to replace this placeholder.\")\n",
                );
            }
            ToolchainKind::Node => {
                content.push_str(&format!("test('{}', () => {{\n", test_id));
                content.push_str(
                    "  throw new Error('Generated CDD scaffold test. Implement behavior to replace this placeholder.');\n",
                );
                content.push_str("});\n");
            }
            ToolchainKind::Unknown => {
                content.push_str(&format!("- {}\n", test_id));
            }
        }

        fs::write(&target, content).with_context(|| {
            format!(
                "Unable to write generated test scaffold '{}'.",
                target.display()
            )
        })?;
        generated_files.push(GeneratedTestFile {
            path: target,
            test_id: test_id.to_string(),
            description: next_action.description.clone(),
        });
    }

    Ok(generated_files)
}

fn derive_context_test_output_dir(context_file: &Path) -> Result<PathBuf> {
    let mut components = Vec::<String>::new();
    let mut found_context_root = false;

    for component in context_file.components() {
        let Component::Normal(part) = component else {
            continue;
        };
        let part = part.to_string_lossy();
        if found_context_root {
            components.push(part.to_string());
            continue;
        }
        if part == "context" {
            found_context_root = true;
        }
    }

    if components.is_empty() {
        bail!(
            "Context file '{}' is not under a 'context/' directory. Expected pattern: .../context/<project>/<feature>/<context-file>.md",
            context_file.display()
        );
    }

    let file_name = components
        .pop()
        .and_then(|name| Path::new(&name).file_stem().map(|stem| stem.to_owned()))
        .and_then(|stem| stem.to_str().map(|value| value.to_string()))
        .unwrap_or_else(|| "context".to_string());

    let mut output_dir = PathBuf::from("tests");
    for folder in components {
        output_dir.push(sanitize_for_path(&folder));
    }
    output_dir.push(sanitize_for_path(&file_name));
    Ok(output_dir)
}

fn sanitize_for_path(input: &str) -> String {
    let mut value = input
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '_' || ch == '-' {
                ch
            } else {
                '_'
            }
        })
        .collect::<String>()
        .to_ascii_lowercase();
    while value.contains("__") {
        value = value.replace("__", "_");
    }
    let trimmed = value.trim_matches('_').to_string();
    if trimmed.is_empty() {
        "context".to_string()
    } else {
        trimmed
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn derives_nested_test_output_dir_from_context_path() {
        let context_file = Path::new(
            ".nexus/context/playground/btc-price-cli/PLA_001-hello-world-btcusdt-dev-loop.md",
        );
        let output = derive_context_test_output_dir(context_file).expect("path should resolve");
        assert_eq!(
            output,
            PathBuf::from("tests/playground/btc-price-cli/pla_001-hello-world-btcusdt-dev-loop")
        );
    }
}
