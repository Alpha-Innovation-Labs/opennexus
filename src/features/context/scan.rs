use anyhow::{bail, Context, Result};
use std::fs;
use std::path::{Path, PathBuf};

use super::parser::parse_context_file;

#[derive(Debug, Default)]
pub(crate) struct ContextScanResult {
    pub valid_context_files: Vec<PathBuf>,
    pub parse_errors: Vec<String>,
}

pub(crate) fn scan_valid_context_specs(root: &Path) -> Result<ContextScanResult> {
    if !root.exists() {
        bail!(
            "Global backfill requires '.nexus/context/' to exist. Remediation: run `opennexus setup` or create context specs first."
        );
    }

    let mut stack = vec![root.to_path_buf()];
    let mut valid = Vec::<PathBuf>::new();
    let mut parse_errors = Vec::<String>::new();

    while let Some(dir) = stack.pop() {
        let entries = fs::read_dir(&dir)
            .with_context(|| format!("Unable to read context directory '{}'.", dir.display()))?;
        for entry in entries {
            let entry = entry
                .with_context(|| format!("Unable to read an entry under '{}'.", dir.display()))?;
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
                continue;
            }
            if !is_context_markdown_candidate(&path) {
                continue;
            }

            match parse_context_file(&path) {
                Ok(_) => valid.push(path),
                Err(err) => parse_errors.push(format!(
                    "{}: {}",
                    path.display(),
                    err.to_string().replace('\n', " ")
                )),
            }
        }
    }

    valid.sort();
    Ok(ContextScanResult {
        valid_context_files: valid,
        parse_errors,
    })
}

fn is_context_markdown_candidate(path: &Path) -> bool {
    if path.file_name().and_then(|name| name.to_str()) == Some("index.md") {
        return false;
    }
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.eq_ignore_ascii_case("md"))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn context_backfill_all_scans_and_filters_valid_context_specs() {
        let temp = tempdir().expect("tempdir");
        let root = temp.path().join(".nexus/context");
        fs::create_dir_all(root.join("project/feature")).expect("create dirs");

        let valid = root.join("project/feature/CDD_201-valid.md");
        let invalid = root.join("project/feature/CDD_202-invalid.md");
        fs::write(
            &valid,
            "---\ncontext_id: CDD_201\n---\n\n## Next Actions\n\n| Description | Test |\n|-------------|------|\n| Do thing | `valid_test` |\n",
        )
        .expect("write valid");
        fs::write(&invalid, "## Next Actions\n").expect("write invalid");

        let scanned = scan_valid_context_specs(&root).expect("scan should pass");
        assert_eq!(scanned.valid_context_files.len(), 1);
        assert_eq!(scanned.parse_errors.len(), 1);
    }
}
