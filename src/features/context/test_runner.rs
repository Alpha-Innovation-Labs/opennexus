use anyhow::{bail, Context, Result};
use regex::Regex;
use std::collections::BTreeSet;
use std::fs;
use std::path::Path;
use std::process::Command;
use std::process::Output;

use crate::core::context::model::ContextParseResult;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum RunnerSource {
    CliOverride,
    RuleFile,
    AutoDetected,
}

impl RunnerSource {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::CliOverride => "cli-override",
            Self::RuleFile => "rule-file",
            Self::AutoDetected => "auto-detected",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ToolchainKind {
    Rust,
    Python,
    Node,
    Unknown,
}

impl ToolchainKind {
    pub(crate) fn as_str(self) -> &'static str {
        match self {
            Self::Rust => "rust",
            Self::Python => "python",
            Self::Node => "node",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone)]
pub(crate) struct TestRunnerPlan {
    pub source: RunnerSource,
    pub toolchain: ToolchainKind,
    pub verify_command_template: String,
    pub discovery_command: Option<String>,
    pub detected_signals: Vec<String>,
    pub attempted_sources: Vec<String>,
}

impl TestRunnerPlan {
    pub(crate) fn verify_command_for_test(&self, test_id: &str) -> String {
        if self.verify_command_template.contains("{test_id}") {
            return self.verify_command_template.replace("{test_id}", test_id);
        }
        format!("{} {}", self.verify_command_template, test_id)
    }
}

pub(crate) fn resolve_test_runner_plan(
    repo_root: &Path,
    parsed: &ContextParseResult,
    selected_rule_path: Option<&Path>,
    cli_test_command: Option<&str>,
    cli_test_discovery_command: Option<&str>,
) -> Result<TestRunnerPlan> {
    let mut detected_signals = gather_detection_signals(repo_root, parsed);
    let mut attempted_sources = Vec::<String>::new();

    if let Some(verify) = cli_test_command {
        attempted_sources.push("explicit CLI override (--test-command)".to_string());
        return Ok(TestRunnerPlan {
            source: RunnerSource::CliOverride,
            toolchain: detect_toolchain(repo_root, parsed, selected_rule_path),
            verify_command_template: verify.to_string(),
            discovery_command: cli_test_discovery_command.map(str::to_string),
            detected_signals,
            attempted_sources,
        });
    }
    attempted_sources.push("explicit CLI override (--test-command): not provided".to_string());

    if let Some(rule_path) = selected_rule_path {
        attempted_sources.push(format!("rule file '{}': scanned", rule_path.display()));
        let rule_commands = extract_rule_commands(rule_path)?;
        if let Some(verify) = rule_commands.verify_command {
            return Ok(TestRunnerPlan {
                source: RunnerSource::RuleFile,
                toolchain: detect_toolchain(repo_root, parsed, selected_rule_path),
                verify_command_template: verify,
                discovery_command: rule_commands.discovery_command,
                detected_signals,
                attempted_sources,
            });
        }
        attempted_sources.push(format!(
            "rule file '{}': no test_command key found",
            rule_path.display()
        ));
    } else {
        attempted_sources.push("rule file: none selected".to_string());
    }

    let toolchain = detect_toolchain(repo_root, parsed, selected_rule_path);
    match toolchain {
        ToolchainKind::Rust => Ok(TestRunnerPlan {
            source: RunnerSource::AutoDetected,
            toolchain,
            verify_command_template: "cargo test {test_id} -- --exact".to_string(),
            discovery_command: Some("cargo test -- --list".to_string()),
            detected_signals,
            attempted_sources,
        }),
        ToolchainKind::Python => Ok(TestRunnerPlan {
            source: RunnerSource::AutoDetected,
            toolchain,
            verify_command_template: "uvx pytest -k {test_id}".to_string(),
            discovery_command: Some("uvx pytest --collect-only -q".to_string()),
            detected_signals,
            attempted_sources,
        }),
        ToolchainKind::Node => Ok(TestRunnerPlan {
            source: RunnerSource::AutoDetected,
            toolchain,
            verify_command_template: "npm test -- {test_id}".to_string(),
            discovery_command: None,
            detected_signals,
            attempted_sources,
        }),
        ToolchainKind::Unknown => {
            if detected_signals.is_empty() {
                detected_signals.push("none".to_string());
            }
            bail!(
                "Unable to resolve a test command for `opennexus context implement`.\nDetected signals: {}\nAttempted resolution: {}\nProvide an explicit override with: --test-command \"<command with {{test_id}} placeholder>\"\nOptional discovery override: --test-discovery-command \"<command>\"",
                detected_signals.join(", "),
                attempted_sources.join("; "),
            );
        }
    }
}

pub(crate) fn discover_tests_with_plan(plan: &TestRunnerPlan) -> Result<Option<BTreeSet<String>>> {
    let Some(command) = &plan.discovery_command else {
        return Ok(None);
    };

    let output = run_shell_command(command)
        .with_context(|| format!("Failed to execute test discovery command '{}'.", command))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        bail!(
            "Test discovery command failed ('{}'). stderr: {}",
            command,
            stderr.trim()
        );
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(Some(parse_discovered_tests(&stdout)))
}

pub(crate) fn run_test_with_plan(plan: &TestRunnerPlan, test_id: &str) -> Result<bool> {
    let output = run_test_with_plan_capture(plan, test_id)?;
    Ok(output.status.success())
}

pub(crate) fn run_test_with_plan_capture(plan: &TestRunnerPlan, test_id: &str) -> Result<Output> {
    let command = plan.verify_command_for_test(test_id);
    let output = run_shell_command(&command)
        .with_context(|| format!("Failed to execute test command '{}'.", command))?;
    Ok(output)
}

pub(crate) fn is_test_discovered(test_id: &str, discovered: &BTreeSet<String>) -> bool {
    let prefixed = format!("test_{}", test_id);
    discovered.iter().any(|name| {
        name == test_id
            || name.ends_with(&format!("::{}", test_id))
            || name == &prefixed
            || name.ends_with(&format!("::{}", prefixed))
    })
}

pub(crate) fn missing_tests(targets: &[String], discovered: &BTreeSet<String>) -> Vec<String> {
    targets
        .iter()
        .filter(|test_id| !is_test_discovered(test_id, discovered))
        .cloned()
        .collect()
}

fn run_shell_command(command: &str) -> Result<std::process::Output> {
    Command::new("sh")
        .args(["-c", command])
        .output()
        .with_context(|| format!("Unable to execute shell command '{}'.", command))
}

fn parse_discovered_tests(output: &str) -> BTreeSet<String> {
    let mut tests = BTreeSet::<String>::new();
    for line in output.lines() {
        let trimmed = line.trim();
        if let Some(name) = trimmed.strip_suffix(": test") {
            tests.insert(name.trim().to_string());
            continue;
        }
        if let Some((left, _right)) = trimmed.split_once("::") {
            if !left.is_empty() {
                tests.insert(trimmed.to_string());
            }
            continue;
        }
        if trimmed.starts_with("test_") {
            tests.insert(trimmed.to_string());
        }
    }
    tests
}

#[derive(Debug, Default)]
struct RuleCommands {
    verify_command: Option<String>,
    discovery_command: Option<String>,
}

fn extract_rule_commands(rule_path: &Path) -> Result<RuleCommands> {
    let content = fs::read_to_string(rule_path).with_context(|| {
        format!(
            "Unable to read selected rule file '{}'.",
            rule_path.display()
        )
    })?;

    let verify_re = Regex::new(r"(?m)^\s*(?:test_command|test-run-command)\s*:\s*(.+?)\s*$")
        .expect("verify regex");
    let discovery_re =
        Regex::new(r"(?m)^\s*(?:test_discovery_command|test-list-command)\s*:\s*(.+?)\s*$")
            .expect("discovery regex");

    Ok(RuleCommands {
        verify_command: verify_re
            .captures(&content)
            .and_then(|captures| captures.get(1))
            .map(|matched| matched.as_str().trim().trim_matches('"').to_string()),
        discovery_command: discovery_re
            .captures(&content)
            .and_then(|captures| captures.get(1))
            .map(|matched| matched.as_str().trim().trim_matches('"').to_string()),
    })
}

fn gather_detection_signals(repo_root: &Path, parsed: &ContextParseResult) -> Vec<String> {
    let mut signals = Vec::<String>::new();
    if let Some(language) = &parsed.language {
        signals.push(format!("context.language={}", language));
    }
    if let Some(runner) = &parsed.test_runner {
        signals.push(format!("context.test_runner={}", runner));
    }

    if repo_root.join("Cargo.toml").exists() {
        signals.push("Cargo.toml".to_string());
    }
    if repo_root.join("pyproject.toml").exists()
        || repo_root.join("pytest.ini").exists()
        || repo_root.join("requirements.txt").exists()
    {
        signals.push("python project marker".to_string());
    }
    if repo_root.join("package.json").exists() {
        signals.push("package.json".to_string());
    }
    signals
}

fn detect_toolchain(
    repo_root: &Path,
    parsed: &ContextParseResult,
    selected_rule_path: Option<&Path>,
) -> ToolchainKind {
    if let Some(runner) = parsed.test_runner.as_deref() {
        let normalized = runner.trim().to_ascii_lowercase();
        if normalized.contains("cargo") {
            return ToolchainKind::Rust;
        }
        if normalized.contains("pytest") || normalized.contains("python") {
            return ToolchainKind::Python;
        }
        if normalized.contains("npm")
            || normalized.contains("node")
            || normalized.contains("jest")
            || normalized.contains("vitest")
            || normalized.contains("bun")
        {
            return ToolchainKind::Node;
        }
    }

    if let Some(language) = parsed.language.as_deref() {
        let normalized = language.trim().to_ascii_lowercase();
        if normalized.contains("rust") {
            return ToolchainKind::Rust;
        }
        if normalized.contains("python") {
            return ToolchainKind::Python;
        }
        if normalized.contains("node")
            || normalized.contains("javascript")
            || normalized.contains("typescript")
            || normalized == "js"
            || normalized == "ts"
        {
            return ToolchainKind::Node;
        }
    }

    if let Some(rule_path) = selected_rule_path {
        let normalized = rule_path.to_string_lossy().to_ascii_lowercase();
        if normalized.contains("python") {
            return ToolchainKind::Python;
        }
        if normalized.contains("rust") {
            return ToolchainKind::Rust;
        }
        if normalized.contains("node")
            || normalized.contains("nextjs")
            || normalized.contains("javascript")
            || normalized.contains("typescript")
        {
            return ToolchainKind::Node;
        }
    }

    if repo_root.join("Cargo.toml").exists() {
        return ToolchainKind::Rust;
    }
    if repo_root.join("pyproject.toml").exists()
        || repo_root.join("pytest.ini").exists()
        || repo_root.join("requirements.txt").exists()
    {
        return ToolchainKind::Python;
    }
    if repo_root.join("package.json").exists() {
        return ToolchainKind::Node;
    }
    ToolchainKind::Unknown
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::context::model::ContextNextAction;
    use tempfile::tempdir;

    fn parsed_context() -> ContextParseResult {
        ContextParseResult {
            context_id: "CTX_001".to_string(),
            tests: vec!["alpha_test".to_string()],
            next_actions: vec![ContextNextAction {
                description: "alpha".to_string(),
                test_id: "alpha_test".to_string(),
            }],
            test_runner: None,
            language: None,
        }
    }

    #[test]
    fn resolves_rust_project_to_cargo_commands() {
        let dir = tempdir().expect("tempdir");
        fs::write(dir.path().join("Cargo.toml"), "[package]\nname='x'\n").expect("write cargo");
        let plan = resolve_test_runner_plan(dir.path(), &parsed_context(), None, None, None)
            .expect("plan");
        assert_eq!(plan.toolchain, ToolchainKind::Rust);
        assert_eq!(
            plan.verify_command_template,
            "cargo test {test_id} -- --exact"
        );
        assert_eq!(
            plan.discovery_command.as_deref(),
            Some("cargo test -- --list")
        );
    }

    #[test]
    fn resolves_python_project_to_pytest_commands() {
        let dir = tempdir().expect("tempdir");
        fs::write(dir.path().join("pyproject.toml"), "[project]\nname='x'\n")
            .expect("write pyproject");
        let plan = resolve_test_runner_plan(dir.path(), &parsed_context(), None, None, None)
            .expect("plan");
        assert_eq!(plan.toolchain, ToolchainKind::Python);
        assert_eq!(plan.verify_command_template, "uvx pytest -k {test_id}");
        assert_eq!(
            plan.discovery_command.as_deref(),
            Some("uvx pytest --collect-only -q")
        );
    }

    #[test]
    fn resolves_node_project_to_npm_commands() {
        let dir = tempdir().expect("tempdir");
        fs::write(dir.path().join("package.json"), "{\"name\":\"x\"}").expect("write package.json");
        let plan = resolve_test_runner_plan(dir.path(), &parsed_context(), None, None, None)
            .expect("plan");
        assert_eq!(plan.toolchain, ToolchainKind::Node);
        assert_eq!(plan.verify_command_template, "npm test -- {test_id}");
        assert!(plan.discovery_command.is_none());
    }

    #[test]
    fn reports_actionable_error_when_no_tooling_detected() {
        let dir = tempdir().expect("tempdir");
        let err = resolve_test_runner_plan(dir.path(), &parsed_context(), None, None, None)
            .expect_err("should fail");
        let text = err.to_string();
        assert!(text.contains("Unable to resolve a test command"));
        assert!(text.contains("--test-command"));
    }
}
