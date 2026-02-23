//! Marketplace commands for searching and installing Nexus assets.

use anyhow::{bail, Context, Result};
use reqwest::blocking::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::Duration;
use tempfile::TempDir;

use crate::cli::OutputFormat;
use crate::output::{print_info, print_success};

const DEFAULT_REGISTRY_URL: &str =
    "https://raw.githubusercontent.com/Alpha-Innovation-Labs/nexus/main/.nexus/marketplace/registry.json";

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
enum MarketplaceAssetKind {
    Context,
    Skill,
    Rule,
    Bundle,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
struct RegistryEntry {
    id: String,
    name: String,
    description: String,
    source: String,
    kind: MarketplaceAssetKind,
    #[serde(default)]
    path: Option<String>,
    #[serde(default)]
    install_name: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct GitHubRepoRef {
    owner: String,
    repo: String,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
struct InstallReport {
    installed_contexts: usize,
    installed_skills: usize,
    installed_rules: usize,
}

pub fn run_marketplace_search(query: &str, format: OutputFormat) -> Result<()> {
    let registry = fetch_registry_entries()?;
    let matches = search_entries(query, &registry);

    if format == OutputFormat::Json {
        println!(
            "{}",
            serde_json::json!({
                "status": "ok",
                "query": query,
                "results": matches,
            })
        );
        return Ok(());
    }

    if matches.is_empty() {
        print_info(&format!(
            "No marketplace entries found for query '{}'.",
            query
        ));
        return Ok(());
    }

    print_success(&format!("Found {} marketplace entrie(s):", matches.len()));
    for entry in matches {
        eprintln!(
            "- {} ({})\n  {}\n  install: opennexus marketplace install {}",
            entry.id, entry.name, entry.description, entry.id
        );
    }

    Ok(())
}

pub fn run_marketplace_install(target: &str, format: OutputFormat) -> Result<()> {
    if format == OutputFormat::Json {
        println!(
            "{}",
            serde_json::json!({
                "status": "starting",
                "target": target,
            })
        );
    } else {
        print_info(&format!("Installing marketplace target '{}'...", target));
    }

    let report = if let Some(repo_ref) = parse_github_repo_target(target) {
        install_from_github_source(&repo_ref)
            .with_context(|| format!("Failed to install from '{}'.", target))?
    } else {
        let registry = fetch_registry_entries()?;
        let entry = resolve_registry_entry(target, &registry).with_context(|| {
            format!(
                "Target '{}' is not a registry entry and not a valid github.com/<owner>/<repo> source.",
                target
            )
        })?;
        install_from_registry_entry(entry)
            .with_context(|| format!("Failed to install registry entry '{}'.", target))?
    };

    if format == OutputFormat::Json {
        println!(
            "{}",
            serde_json::json!({
                "status": "completed",
                "target": target,
                "installed_contexts": report.installed_contexts,
                "installed_skills": report.installed_skills,
                "installed_rules": report.installed_rules,
            })
        );
    } else {
        print_success(&format!(
            "Installed target '{}' (contexts: {}, skills: {}, rules: {})",
            target, report.installed_contexts, report.installed_skills, report.installed_rules
        ));
    }

    Ok(())
}

fn fetch_registry_entries() -> Result<Vec<RegistryEntry>> {
    let registry_url = std::env::var("NEXUS_MARKETPLACE_REGISTRY_URL")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| DEFAULT_REGISTRY_URL.to_string());

    let body = if let Some(file_path) = registry_url.strip_prefix("file://") {
        fs::read_to_string(file_path)
            .with_context(|| format!("Failed to read registry from '{}'.", file_path))?
    } else {
        let client = Client::builder()
            .timeout(Duration::from_secs(20))
            .build()
            .context("Failed to create HTTP client for marketplace registry fetch.")?;

        let response = client
            .get(&registry_url)
            .send()
            .context("Failed to fetch marketplace registry.")?;
        let response = response
            .error_for_status()
            .context("Failed to fetch marketplace registry.")?;
        response
            .text()
            .context("Failed to decode marketplace registry response body.")?
    };

    serde_json::from_str::<Vec<RegistryEntry>>(&body)
        .context("Marketplace registry payload is invalid JSON.")
}

fn search_entries<'a>(query: &str, entries: &'a [RegistryEntry]) -> Vec<&'a RegistryEntry> {
    let lowered = query.trim().to_ascii_lowercase();
    if lowered.is_empty() {
        return entries.iter().collect();
    }

    entries
        .iter()
        .filter(|entry| {
            entry.id.to_ascii_lowercase().contains(&lowered)
                || entry.name.to_ascii_lowercase().contains(&lowered)
                || entry.description.to_ascii_lowercase().contains(&lowered)
        })
        .collect()
}

fn resolve_registry_entry<'a>(
    target: &str,
    entries: &'a [RegistryEntry],
) -> Result<&'a RegistryEntry> {
    let normalized = target.trim().to_ascii_lowercase();
    entries
        .iter()
        .find(|entry| {
            entry.id.eq_ignore_ascii_case(&normalized)
                || entry.name.eq_ignore_ascii_case(&normalized)
        })
        .ok_or_else(|| anyhow::anyhow!("Unknown marketplace target '{}'.", target))
}

fn parse_github_repo_target(target: &str) -> Option<GitHubRepoRef> {
    let trimmed = target.trim();
    let raw = trimmed.strip_prefix("https://").unwrap_or(trimmed);
    let raw = raw.strip_prefix("http://").unwrap_or(raw);
    let raw = raw.strip_prefix("github.com/")?;
    let raw = raw.strip_suffix(".git").unwrap_or(raw);
    let mut segments = raw.split('/');
    let owner = segments.next()?.trim();
    let repo = segments.next()?.trim();

    if owner.is_empty() || repo.is_empty() || segments.next().is_some() {
        return None;
    }

    Some(GitHubRepoRef {
        owner: owner.to_string(),
        repo: repo.to_string(),
    })
}

fn install_from_registry_entry(entry: &RegistryEntry) -> Result<InstallReport> {
    let source = parse_github_repo_target(&entry.source).with_context(|| {
        format!(
            "Registry entry '{}' has unsupported source '{}'. Expected github.com/<owner>/<repo>.",
            entry.id, entry.source
        )
    })?;

    let temp_dir = clone_github_repo(&source)?;
    install_from_repo_path(
        temp_dir.path(),
        &entry.kind,
        entry.path.as_deref(),
        entry.install_name.as_deref(),
    )
}

fn install_from_github_source(source: &GitHubRepoRef) -> Result<InstallReport> {
    let temp_dir = clone_github_repo(source)?;
    install_bundle(temp_dir.path().join(".nexus"))
}

fn clone_github_repo(source: &GitHubRepoRef) -> Result<TempDir> {
    let tmp =
        TempDir::new().context("Failed to create temporary directory for repository clone.")?;
    let checkout_dir = tmp.path().join("repo");
    let repo_url = format!("https://github.com/{}/{}.git", source.owner, source.repo);

    let output = Command::new("git")
        .args(["clone", "--depth", "1", &repo_url])
        .arg(&checkout_dir)
        .output()
        .context("Failed to invoke git while installing marketplace package.")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        bail!(
            "Unable to clone repository '{}': {}",
            repo_url,
            stderr.trim()
        );
    }

    Ok(tmp)
}

fn install_from_repo_path(
    repo_root: &Path,
    kind: &MarketplaceAssetKind,
    source_path: Option<&str>,
    install_name: Option<&str>,
) -> Result<InstallReport> {
    match kind {
        MarketplaceAssetKind::Bundle => {
            let source = source_path
                .map(|value| repo_root.join(value))
                .unwrap_or_else(|| repo_root.join(".nexus"));
            install_bundle(source)
        }
        MarketplaceAssetKind::Context => {
            let source = required_source_path(repo_root, source_path, "context")?;
            install_context(source, install_name)
        }
        MarketplaceAssetKind::Skill => {
            let source = required_source_path(repo_root, source_path, "skill")?;
            install_skill(source, install_name)
        }
        MarketplaceAssetKind::Rule => {
            let source = required_source_path(repo_root, source_path, "rule")?;
            install_rule(source, install_name)
        }
    }
}

fn required_source_path<'a>(
    repo_root: &'a Path,
    source_path: Option<&str>,
    kind: &str,
) -> Result<PathBuf> {
    let source_path = source_path
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            anyhow::anyhow!(
                "Registry entry is missing source path for {} package.",
                kind
            )
        })?;
    Ok(repo_root.join(source_path))
}

fn install_bundle(source_nexus_dir: PathBuf) -> Result<InstallReport> {
    if !source_nexus_dir.exists() {
        bail!(
            "Repository does not contain a '.nexus' package directory at '{}'.",
            source_nexus_dir.display()
        );
    }

    let mut report = InstallReport {
        installed_contexts: 0,
        installed_skills: 0,
        installed_rules: 0,
    };

    let contexts = source_nexus_dir.join("context");
    if contexts.is_dir() {
        let target_root = Path::new(".nexus/context");
        ensure_dir(target_root)?;
        for entry in fs::read_dir(&contexts)? {
            let entry = entry?;
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let Some(name) = path.file_name() else {
                continue;
            };
            let target = target_root.join(name);
            copy_dir_recursive(&path, &target)?;
            report.installed_contexts += 1;
        }
    }

    let skills = source_nexus_dir.join("ai_harness/skills");
    let legacy_skills = source_nexus_dir.join("skills");
    let skills = if skills.is_dir() {
        skills
    } else {
        legacy_skills
    };
    if skills.is_dir() {
        let target_root = Path::new(".nexus/ai_harness/skills");
        ensure_dir(target_root)?;
        for entry in fs::read_dir(&skills)? {
            let entry = entry?;
            let path = entry.path();
            if !path.is_dir() {
                continue;
            }
            let Some(name) = path.file_name() else {
                continue;
            };
            let target = target_root.join(name);
            copy_dir_recursive(&path, &target)?;
            report.installed_skills += 1;
        }
    }

    let rules = source_nexus_dir.join("ai_harness/rules");
    let legacy_rules = source_nexus_dir.join("rules");
    let rules = if rules.is_dir() { rules } else { legacy_rules };
    if rules.is_dir() {
        let target_root = Path::new(".nexus/ai_harness/rules");
        ensure_dir(target_root)?;
        for entry in fs::read_dir(&rules)? {
            let entry = entry?;
            let path = entry.path();
            let Some(name) = path.file_name() else {
                continue;
            };
            let target = target_root.join(name);
            if path.is_dir() {
                copy_dir_recursive(&path, &target)?;
                report.installed_rules += 1;
            } else if path.is_file() {
                fs::copy(&path, target)?;
                report.installed_rules += 1;
            }
        }
    }

    if report.installed_contexts == 0 && report.installed_skills == 0 && report.installed_rules == 0
    {
        bail!(
            "No Nexus-compatible assets found under '{}'. Expected context/, ai_harness/skills/ (or legacy skills/), or ai_harness/rules/ (or legacy rules/).",
            source_nexus_dir.display()
        );
    }

    Ok(report)
}

fn install_context(source: PathBuf, install_name: Option<&str>) -> Result<InstallReport> {
    if !source.is_dir() {
        bail!("Context source '{}' is not a directory.", source.display());
    }
    let context_name = resolve_install_name(&source, install_name, "context")?;
    let target = Path::new(".nexus/context").join(context_name);
    copy_dir_recursive(&source, &target)?;
    Ok(InstallReport {
        installed_contexts: 1,
        installed_skills: 0,
        installed_rules: 0,
    })
}

fn install_skill(source: PathBuf, install_name: Option<&str>) -> Result<InstallReport> {
    if !source.is_dir() {
        bail!("Skill source '{}' is not a directory.", source.display());
    }
    let skill_name = resolve_install_name(&source, install_name, "skill")?;
    let target = Path::new(".nexus/ai_harness/skills").join(skill_name);
    copy_dir_recursive(&source, &target)?;
    Ok(InstallReport {
        installed_contexts: 0,
        installed_skills: 1,
        installed_rules: 0,
    })
}

fn install_rule(source: PathBuf, install_name: Option<&str>) -> Result<InstallReport> {
    let rules_root = Path::new(".nexus/ai_harness/rules");
    ensure_dir(rules_root)?;

    let mut installed = 0;
    if source.is_file() {
        let target_name = install_name
            .map(ToOwned::to_owned)
            .or_else(|| {
                source
                    .file_name()
                    .map(|value| value.to_string_lossy().to_string())
            })
            .ok_or_else(|| anyhow::anyhow!("Unable to resolve install name for rule source."))?;
        fs::copy(&source, rules_root.join(target_name))?;
        installed = 1;
    } else if source.is_dir() {
        let has_rule_manifest = source.join("RULE.md").exists() || source.join("SKILL.md").exists();
        if has_rule_manifest {
            let rule_name = resolve_install_name(&source, install_name, "rule")?;
            let target = rules_root.join(rule_name);
            copy_dir_recursive(&source, &target)?;
            installed = 1;
        } else {
            for entry in fs::read_dir(&source)? {
                let entry = entry?;
                let path = entry.path();
                if !path.is_file() {
                    continue;
                }
                let Some(file_name) = path.file_name() else {
                    continue;
                };
                fs::copy(&path, rules_root.join(file_name))?;
                installed += 1;
            }
        }
    } else {
        bail!("Rule source '{}' does not exist.", source.display());
    }

    if installed == 0 {
        bail!(
            "Rule source '{}' did not include any files.",
            source.display()
        );
    }

    Ok(InstallReport {
        installed_contexts: 0,
        installed_skills: 0,
        installed_rules: installed,
    })
}

fn resolve_install_name(source: &Path, install_name: Option<&str>, kind: &str) -> Result<String> {
    install_name
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .or_else(|| {
            source
                .file_name()
                .map(|value| value.to_string_lossy().to_string())
        })
        .ok_or_else(|| anyhow::anyhow!("Unable to resolve install name for {} package.", kind))
}

fn ensure_dir(path: &Path) -> Result<()> {
    if !path.exists() {
        fs::create_dir_all(path)
            .with_context(|| format!("Failed to create directory '{}'.", path.display()))?;
    }
    Ok(())
}

fn copy_dir_recursive(source: &Path, target: &Path) -> Result<()> {
    ensure_dir(target)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let source_path = entry.path();
        let target_path = target.join(entry.file_name());
        if source_path.is_dir() {
            copy_dir_recursive(&source_path, &target_path)?;
        } else {
            if let Some(parent) = target_path.parent() {
                ensure_dir(parent)?;
            }
            fs::copy(&source_path, &target_path).with_context(|| {
                format!(
                    "Failed to copy '{}' to '{}'.",
                    source_path.display(),
                    target_path.display()
                )
            })?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture_registry() -> Vec<RegistryEntry> {
        vec![
            RegistryEntry {
                id: "fumadocs".to_string(),
                name: "Fumadocs Starter".to_string(),
                description: "Fumadocs context package".to_string(),
                source: "github.com/Alpha-Innovation-Labs/nexus".to_string(),
                kind: MarketplaceAssetKind::Context,
                path: Some(".nexus/context/fumadocs".to_string()),
                install_name: Some("fumadocs".to_string()),
            },
            RegistryEntry {
                id: "rust-rules".to_string(),
                name: "Rust Rules".to_string(),
                description: "Rust rule pack".to_string(),
                source: "github.com/example/rules".to_string(),
                kind: MarketplaceAssetKind::Rule,
                path: Some(".nexus/ai_harness/rules".to_string()),
                install_name: None,
            },
        ]
    }

    #[test]
    fn search_matches_id_and_description() {
        let registry = fixture_registry();
        let results = search_entries("fumadocs", &registry);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "fumadocs");

        let results = search_entries("rule", &registry);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, "rust-rules");
    }

    #[test]
    fn resolve_registry_entry_by_id() {
        let registry = fixture_registry();
        let entry = resolve_registry_entry("fumadocs", &registry).expect("entry should resolve");
        assert_eq!(entry.id, "fumadocs");
    }

    #[test]
    fn resolve_registry_entry_returns_error_when_missing() {
        let registry = fixture_registry();
        let err =
            resolve_registry_entry("missing", &registry).expect_err("entry should not resolve");
        assert!(err.to_string().contains("Unknown marketplace target"));
    }

    #[test]
    fn parse_github_repo_target_accepts_expected_formats() {
        let parsed =
            parse_github_repo_target("github.com/owner/repo").expect("target should parse");
        assert_eq!(parsed.owner, "owner");
        assert_eq!(parsed.repo, "repo");

        let parsed = parse_github_repo_target("https://github.com/owner/repo.git")
            .expect("target should parse");
        assert_eq!(parsed.owner, "owner");
        assert_eq!(parsed.repo, "repo");
    }

    #[test]
    fn parse_github_repo_target_rejects_invalid_target() {
        assert!(parse_github_repo_target("owner/repo").is_none());
        assert!(parse_github_repo_target("github.com/owner").is_none());
        assert!(parse_github_repo_target("github.com/owner/repo/tree/main").is_none());
    }

    #[test]
    fn install_bundle_copies_context_and_skill() {
        let temp = TempDir::new().expect("temp dir should create");
        let repo_root = temp.path().join("repo");
        let source_nexus = repo_root.join(".nexus");
        fs::create_dir_all(source_nexus.join("context/fumadocs"))
            .expect("context dir should create");
        fs::create_dir_all(source_nexus.join("ai_harness/skills/ratkit"))
            .expect("skill dir should create");
        fs::write(source_nexus.join("context/fumadocs/index.md"), "context").expect("context file");
        fs::write(
            source_nexus.join("ai_harness/skills/ratkit/SKILL.md"),
            "skill",
        )
        .expect("skill file");

        let workdir = temp.path().join("workspace");
        fs::create_dir_all(&workdir).expect("workspace dir should create");
        let original = std::env::current_dir().expect("cwd should exist");
        std::env::set_current_dir(&workdir).expect("set cwd should work");

        let report = install_bundle(source_nexus).expect("install should succeed");
        assert_eq!(report.installed_contexts, 1);
        assert_eq!(report.installed_skills, 1);
        assert!(workdir.join(".nexus/context/fumadocs/index.md").exists());
        assert!(workdir
            .join(".nexus/ai_harness/skills/ratkit/SKILL.md")
            .exists());

        std::env::set_current_dir(original).expect("restore cwd should work");
    }

    #[test]
    fn install_bundle_fails_when_nexus_package_missing() {
        let temp = TempDir::new().expect("temp dir should create");
        let err = install_bundle(temp.path().join(".nexus")).expect_err("install should fail");
        assert!(err
            .to_string()
            .contains("does not contain a '.nexus' package"));
    }
}
