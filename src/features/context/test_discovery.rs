use anyhow::{bail, Context, Result};
use std::collections::BTreeSet;
use std::process::Command;

pub(crate) fn discover_tests_from_runner() -> Result<BTreeSet<String>> {
    let output = Command::new("cargo")
        .args(["test", "--", "--list"])
        .output()
        .context("Failed to execute `cargo test -- --list` for test discovery.")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        bail!(
            "Test discovery command failed (cargo test -- --list). stderr: {}",
            stderr.trim()
        );
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_discovered_tests(&stdout))
}

pub(crate) fn parse_discovered_tests(output: &str) -> BTreeSet<String> {
    let mut tests = BTreeSet::<String>::new();
    for line in output.lines() {
        let trimmed = line.trim();
        if let Some(name) = trimmed.strip_suffix(": test") {
            tests.insert(name.trim().to_string());
        }
    }
    tests
}

pub(crate) fn missing_tests(targets: &[String], discovered: &BTreeSet<String>) -> Vec<String> {
    targets
        .iter()
        .filter(|test_id| !is_test_discovered(test_id, discovered))
        .cloned()
        .collect()
}

pub(crate) fn is_test_discovered(test_id: &str, discovered: &BTreeSet<String>) -> bool {
    discovered
        .iter()
        .any(|name| name == test_id || name.ends_with(&format!("::{}", test_id)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_discovered_tests_from_cargo_list_output() {
        let output = "foo::bar: test\nfoo::baz: test\n\n2 tests, 0 benchmarks\n";
        let tests = parse_discovered_tests(output);
        assert!(tests.contains("foo::bar"));
        assert!(tests.contains("foo::baz"));
    }

    #[test]
    fn detects_missing_tests_from_discovery_set() {
        let targets = vec!["alpha_test".to_string(), "beta_test".to_string()];
        let discovered = BTreeSet::from(["foo::alpha_test".to_string()]);
        let missing = missing_tests(&targets, &discovered);
        assert_eq!(missing, vec!["beta_test"]);
    }
}
