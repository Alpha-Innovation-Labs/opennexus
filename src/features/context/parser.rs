use anyhow::{anyhow, bail, Context, Result};
use regex::Regex;
use std::collections::BTreeSet;
use std::fs;
use std::path::Path;

use crate::core::context::model::{ContextNextAction, ContextParseResult};

pub fn parse_context_file(path: &Path) -> Result<ContextParseResult> {
    if !path.exists() {
        bail!(
            "Context file '{}' does not exist. Pass --context-file with a valid path.",
            path.display()
        );
    }
    if !path.is_file() {
        bail!(
            "Context path '{}' is not a file. Pass --context-file pointing to a Markdown file.",
            path.display()
        );
    }

    let content = fs::read_to_string(path)
        .with_context(|| format!("Unable to read context file '{}'.", path.display()))?;

    parse_context_content(&content).with_context(|| {
        format!(
            "Failed to parse context file '{}'. Ensure frontmatter and Next Actions table are valid.",
            path.display()
        )
    })
}

pub fn parse_context_content(content: &str) -> Result<ContextParseResult> {
    let context_id = extract_context_id(content)?;
    let next_actions = extract_next_actions(content)?;
    let tests = next_actions
        .iter()
        .map(|action| action.test_id.clone())
        .collect();
    let language = extract_frontmatter_value(content, "language");
    let test_runner = extract_frontmatter_value(content, "test_runner");
    Ok(ContextParseResult {
        context_id,
        tests,
        next_actions,
        test_runner,
        language,
    })
}

fn extract_frontmatter_value(content: &str, wanted_key: &str) -> Option<String> {
    if !content.trim_start().starts_with("---") {
        return None;
    }

    let mut in_frontmatter = false;
    for line in content.lines() {
        if line.trim() == "---" {
            if !in_frontmatter {
                in_frontmatter = true;
                continue;
            }
            break;
        }
        if !in_frontmatter {
            continue;
        }

        let mut chunks = line.splitn(2, ':');
        let key = chunks.next().unwrap_or("").trim();
        let value = chunks.next().unwrap_or("").trim().trim_matches('"');
        if key == wanted_key && !value.is_empty() {
            return Some(value.to_string());
        }
    }

    None
}

fn extract_context_id(content: &str) -> Result<String> {
    if !content.trim_start().starts_with("---") {
        bail!("Context file is missing YAML frontmatter starting with '---'.");
    }

    let mut in_frontmatter = false;
    let mut frontmatter_lines = Vec::<String>::new();
    for line in content.lines() {
        if line.trim() == "---" {
            if !in_frontmatter {
                in_frontmatter = true;
                continue;
            }
            break;
        }
        if in_frontmatter {
            frontmatter_lines.push(line.to_string());
        }
    }

    if frontmatter_lines.is_empty() {
        bail!("Context file frontmatter is empty.");
    }

    for line in frontmatter_lines {
        let mut chunks = line.splitn(2, ':');
        let key = chunks.next().unwrap_or("").trim();
        let value = chunks.next().unwrap_or("").trim().trim_matches('"');
        if key == "context_id" {
            if value.is_empty() {
                bail!("Frontmatter key 'context_id' must not be empty.");
            }
            return Ok(value.to_string());
        }
    }

    bail!("Frontmatter must include 'context_id'.");
}

fn extract_next_actions(content: &str) -> Result<Vec<ContextNextAction>> {
    let lines: Vec<&str> = content.lines().collect();
    let section_index = lines
        .iter()
        .position(|line| line.trim() == "## Next Actions")
        .ok_or_else(|| anyhow!("Missing required '## Next Actions' section."))?;

    let header_index = lines
        .iter()
        .enumerate()
        .skip(section_index + 1)
        .find_map(|(idx, line)| {
            let trimmed = line.trim();
            if trimmed.starts_with('|')
                && trimmed.contains("Description")
                && trimmed.contains("Test")
            {
                Some(idx)
            } else {
                None
            }
        })
        .ok_or_else(|| {
            anyhow!("Next Actions section must include a Markdown table with 'Test' column.")
        })?;

    let snake_case = Regex::new(r"^[a-z][a-z0-9_]*$").expect("snake_case regex");
    let mut test_ids = BTreeSet::<String>::new();
    let mut next_actions = Vec::<ContextNextAction>::new();
    let mut saw_row = false;

    for line in lines.iter().skip(header_index + 2) {
        let trimmed = line.trim();
        if trimmed.is_empty() || !trimmed.starts_with('|') {
            break;
        }
        let columns: Vec<String> = trimmed
            .trim_matches('|')
            .split('|')
            .map(|cell| cell.trim().trim_matches('`').to_string())
            .collect();
        if columns.len() < 2 {
            continue;
        }
        saw_row = true;
        let description = columns[0].trim().to_string();
        let raw_test_id = columns[1].trim();
        let test_id = raw_test_id.strip_prefix("test_").unwrap_or(raw_test_id);
        if test_id.is_empty() {
            bail!("Next Actions table includes an empty Test value.");
        }
        if !snake_case.is_match(test_id) {
            bail!(
                "Invalid test identifier '{}'. Use unique snake_case names in the Test column.",
                test_id
            );
        }
        if !test_ids.insert(test_id.to_string()) {
            bail!(
                "Duplicate test identifier '{}' found in Next Actions table. Use unique Test values.",
                test_id
            );
        }
        next_actions.push(ContextNextAction {
            description,
            test_id: test_id.to_string(),
        });
    }

    if !saw_row {
        bail!("Next Actions table has no data rows with Test values.");
    }
    if next_actions.is_empty() {
        bail!("No valid tests found in Next Actions table.");
    }

    Ok(next_actions)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_unique_tests_from_next_actions() {
        let content = r#"---
context_id: CDD_100
---

## Next Actions

| Description | Test |
|-------------|------|
| One | `alpha_test` |
| Two | `test_beta_test` |
"#;

        let parsed = parse_context_content(content).expect("parse should succeed");
        assert_eq!(parsed.context_id, "CDD_100");
        assert_eq!(parsed.tests, vec!["alpha_test", "beta_test"]);
        assert_eq!(parsed.next_actions.len(), 2);
        assert_eq!(parsed.next_actions[1].test_id, "beta_test");
        assert!(parsed.language.is_none());
        assert!(parsed.test_runner.is_none());
    }

    #[test]
    fn rejects_duplicate_test_identifier() {
        let content = r#"---
context_id: CDD_100
---

## Next Actions

| Description | Test |
|-------------|------|
| One | `alpha_test` |
| Two | `alpha_test` |
"#;

        let err = parse_context_content(content).expect_err("parse should fail");
        assert!(err.to_string().contains("Duplicate test identifier"));
    }

    #[test]
    fn context_backfill_extracts_task_targets_from_next_actions() {
        let content = r#"---
context_id: CDD_017
---

## Next Actions

| Description | Test |
|-------------|------|
| Verify first path | `context_backfill_alpha` |
| Verify second path | `context_backfill_beta` |
"#;

        let parsed = parse_context_content(content).expect("parse should succeed");
        assert_eq!(
            parsed.tests,
            vec!["context_backfill_alpha", "context_backfill_beta"]
        );
    }

    #[test]
    fn rejects_invalid_test_identifier() {
        let content = r#"---
context_id: CDD_101
---

## Next Actions

| Description | Test |
|-------------|------|
| One | `NotSnake` |
"#;

        let err = parse_context_content(content).expect_err("parse should fail");
        assert!(err.to_string().contains("Invalid test identifier"));
    }

    #[test]
    fn extracts_optional_language_and_test_runner_from_frontmatter() {
        let content = r#"---
context_id: CDD_102
language: python
test_runner: pytest
---

## Next Actions

| Description | Test |
|-------------|------|
| One | `alpha_test` |
"#;

        let parsed = parse_context_content(content).expect("parse should succeed");
        assert_eq!(parsed.language.as_deref(), Some("python"));
        assert_eq!(parsed.test_runner.as_deref(), Some("pytest"));
    }
}
