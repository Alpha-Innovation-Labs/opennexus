use anyhow::{bail, Context, Result};
use std::fs;
use std::path::{Path, PathBuf};

pub(crate) fn discover_rule_files(root: &Path) -> Result<Vec<PathBuf>> {
    if !root.exists() {
        return Ok(Vec::new());
    }

    let mut stack = vec![root.to_path_buf()];
    let mut files = Vec::<PathBuf>::new();

    while let Some(dir) = stack.pop() {
        let entries = fs::read_dir(&dir)
            .with_context(|| format!("Unable to read rule directory '{}'.", dir.display()))?;
        for entry in entries {
            let entry = entry
                .with_context(|| format!("Unable to read an entry under '{}'.", dir.display()))?;
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
                continue;
            }
            if !is_coding_rule_candidate(&path) {
                continue;
            }
            let relative = path
                .strip_prefix(root)
                .unwrap_or(path.as_path())
                .to_path_buf();
            files.push(relative);
        }
    }

    files.sort();
    Ok(files)
}

pub(crate) fn select_rule_file(
    discovered: &[PathBuf],
    requested: Option<&str>,
) -> Result<Option<PathBuf>> {
    if discovered.is_empty() {
        return Ok(None);
    }

    if let Some(requested) = requested {
        let candidates: Vec<PathBuf> = discovered
            .iter()
            .filter(|path| {
                path.to_string_lossy() == requested
                    || path
                        .file_name()
                        .map(|name| name.to_string_lossy() == requested)
                        .unwrap_or(false)
            })
            .cloned()
            .collect();
        if candidates.is_empty() {
            bail!(
                "Requested rule '{}' was not found under .nexus/ai_harness/rules/. Choose one of: {}",
                requested,
                discovered
                    .iter()
                    .map(|path| path.display().to_string())
                    .collect::<Vec<String>>()
                    .join(", ")
            );
        }
        if candidates.len() > 1 {
            bail!(
                "Requested rule '{}' is ambiguous. Use an exact relative path under .nexus/ai_harness/rules/. Candidates: {}",
                requested,
                candidates
                    .iter()
                    .map(|path| path.display().to_string())
                    .collect::<Vec<String>>()
                    .join(", ")
            );
        }
        return Ok(Some(
            Path::new(".nexus/ai_harness/rules").join(&candidates[0]),
        ));
    }

    if discovered.len() == 1 {
        return Ok(Some(
            Path::new(".nexus/ai_harness/rules").join(&discovered[0]),
        ));
    }

    bail!(
        "Multiple coding rules discovered under .nexus/ai_harness/rules/: {}. Specify exactly one via --rule-file <relative-path>.",
        discovered
            .iter()
            .map(|path| path.display().to_string())
            .collect::<Vec<String>>()
            .join(", ")
    )
}

fn is_coding_rule_candidate(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| matches!(ext, "md" | "txt" | "yaml" | "yml" | "json"))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn selects_single_discovered_rule_automatically() {
        let selected = select_rule_file(&[PathBuf::from("rust/SKILL.md")], None)
            .expect("selection should pass")
            .expect("rule should be selected");
        assert_eq!(
            selected,
            Path::new(".nexus/ai_harness/rules").join("rust/SKILL.md")
        );
    }

    #[test]
    fn blocks_on_multiple_rules_without_explicit_choice() {
        let err = select_rule_file(
            &[
                PathBuf::from("rust/SKILL.md"),
                PathBuf::from("python/SKILL.md"),
            ],
            None,
        )
        .expect_err("selection should fail");
        assert!(err.to_string().contains("Multiple coding rules discovered"));
    }
}
