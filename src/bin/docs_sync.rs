use std::collections::{BTreeMap, BTreeSet};
use std::env;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::process::Command;

use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Ord, PartialOrd)]
struct SymbolDoc {
    module_path: String,
    kind: String,
    name: String,
    signature: String,
    docs_markdown: String,
    source_path: String,
    symbol_path: String,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Mode {
    Sync,
    Check,
    Guard,
}

const DOCS_SYNC_STATE_PATH: &str = ".nexus/docs-sync-state.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
struct DocsSyncState {
    docs_path: String,
    last_generated_commit: String,
    generated_at: String,
    #[serde(default)]
    last_harness_input_hash: Option<String>,
}

fn main() {
    if let Err(err) = run() {
        eprintln!("docs-sync error: {err}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let mut mode = Mode::Sync;
    let mut llm_enabled = true;
    for arg in env::args().skip(1) {
        match arg.as_str() {
            "sync" => mode = Mode::Sync,
            "check" => mode = Mode::Check,
            "guard" => mode = Mode::Guard,
            "--no-llm" => llm_enabled = false,
            other => {
                return Err(format!(
                    "unknown argument '{other}'. use: docs-sync [sync|check|guard] [--no-llm]"
                ));
            }
        }
    }

    let repo_root = env::current_dir().map_err(|e| format!("failed to read current dir: {e}"))?;
    let src_root = repo_root.join("src");
    let docs_root = repo_root.join("docs/content/docs");
    let reference_root = docs_root.join("reference");

    if !src_root.is_dir() {
        return Err(format!("missing source directory: {}", src_root.display()));
    }
    if !docs_root.is_dir() {
        return Err(format!(
            "missing docs content directory: {}",
            docs_root.display()
        ));
    }

    let rust_files = collect_rs_files(&src_root)?;
    let mut symbols = Vec::new();
    for file in rust_files {
        let mut parsed = parse_rust_file(&repo_root, &src_root, &file)?;
        symbols.append(&mut parsed);
    }

    symbols.sort();

    let temp_root = docs_root.join(format!(".reference_tmp_{}", std::process::id()));
    if temp_root.exists() {
        fs::remove_dir_all(&temp_root)
            .map_err(|e| format!("failed to clean temp dir {}: {e}", temp_root.display()))?;
    }
    fs::create_dir_all(&temp_root)
        .map_err(|e| format!("failed to create temp dir {}: {e}", temp_root.display()))?;

    let rendered_reference_root = temp_root.join("reference");
    render_reference_tree(&rendered_reference_root, &symbols)?;

    match mode {
        Mode::Sync => {
            if reference_root.exists() {
                fs::remove_dir_all(&reference_root).map_err(|e| {
                    format!(
                        "failed to clear existing generated reference docs {}: {e}",
                        reference_root.display()
                    )
                })?;
            }

            fs::rename(&rendered_reference_root, &reference_root).map_err(|e| {
                format!(
                    "failed to atomically replace generated docs into {}: {e}",
                    reference_root.display()
                )
            })?;

            ensure_root_meta(&docs_root)?;

            fs::remove_dir_all(&temp_root).map_err(|e| {
                format!(
                    "failed to remove temp dir after sync {}: {e}",
                    temp_root.display()
                )
            })?;

            println!(
                "generated {} reference docs under {}",
                symbols.len(),
                reference_root.display()
            );

            if llm_enabled {
                maybe_run_llm_docs_update(&repo_root)?;
            }

            Ok(())
        }
        Mode::Check => {
            let diffs = diff_trees(&reference_root, &rendered_reference_root)?;
            fs::remove_dir_all(&temp_root).map_err(|e| {
                format!(
                    "failed to remove temp dir after check {}: {e}",
                    temp_root.display()
                )
            })?;

            if diffs.is_empty() {
                println!("docs sync check passed");
                Ok(())
            } else {
                eprintln!("docs sync check failed; generated docs are out of date:");
                for diff in diffs {
                    eprintln!("- {diff}");
                }
                Err("run `just docs-sync` to refresh generated docs".to_string())
            }
        }
        Mode::Guard => {
            fs::remove_dir_all(&temp_root).map_err(|e| {
                format!(
                    "failed to remove temp dir after guard {}: {e}",
                    temp_root.display()
                )
            })?;

            docs_sync_guard(&repo_root)
        }
    }
}

fn docs_sync_guard(repo_root: &Path) -> Result<(), String> {
    let state = load_docs_sync_state(repo_root)?;
    let changed_paths = staged_and_committed_paths(
        repo_root,
        state
            .as_ref()
            .map(|value| value.last_generated_commit.as_str()),
    )?;

    let harness_paths = harness_paths_from_changed(&changed_paths);
    if harness_paths.is_empty() {
        println!("docs-sync guard: no ai_harness changes detected");
        return Ok(());
    }

    let current_hash = hash_paths(&harness_paths);
    let Some(saved_hash) = state
        .as_ref()
        .and_then(|value| value.last_harness_input_hash.clone())
    else {
        return Err(
            "docs-sync guard: harness changes detected and docs were never synced for this change set. Run `just docs-sync` and re-stage documentation updates.".to_string(),
        );
    };

    if saved_hash != current_hash {
        return Err(
            "docs-sync guard: harness changes differ from last docs-sync run. Run `just docs-sync` and re-stage documentation updates.".to_string(),
        );
    }

    println!("docs-sync guard: harness docs are up to date");
    Ok(())
}

fn harness_paths_from_changed(changed_paths: &[String]) -> Vec<String> {
    changed_paths
        .iter()
        .filter(|path| {
            path.starts_with(".nexus/ai_harness/commands/")
                || path.starts_with(".nexus/ai_harness/skills/")
                || path.starts_with(".nexus/ai_harness/rules/")
        })
        .cloned()
        .collect()
}

fn hash_paths(paths: &[String]) -> String {
    let mut sorted = paths.to_vec();
    sorted.sort();

    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    for path in sorted {
        path.hash(&mut hasher);
    }

    format!("{:016x}", hasher.finish())
}

fn maybe_run_llm_docs_update(repo_root: &Path) -> Result<(), String> {
    let state = load_docs_sync_state(repo_root)?;
    if let Some(existing_state) = state.as_ref() {
        println!(
            "docs-sync: last LLM checkpoint: {} @ {}",
            existing_state.last_generated_commit, existing_state.generated_at
        );
    } else {
        println!("docs-sync: last LLM checkpoint: none");
    }

    let changed_paths = staged_and_committed_paths(
        repo_root,
        state
            .as_ref()
            .map(|value| value.last_generated_commit.as_str()),
    )?;
    if changed_paths.is_empty() {
        println!("docs-sync: no staged or committed changes; skipping LLM docs update");
        return Ok(());
    }

    let harness_paths = harness_paths_from_changed(&changed_paths);
    let harness_changed = !harness_paths.is_empty();

    if !harness_changed {
        println!("docs-sync: no ai_harness changes detected; skipping LLM docs update");
        return Ok(());
    }

    let mut changed = changed_paths;
    changed.sort();
    println!(
        "docs-sync: files considered from staged + committed history ({}):",
        changed.len()
    );
    for path in &changed {
        println!("  - {path}");
    }

    let changed_list = changed
        .iter()
        .map(|p| format!("- {p}"))
        .collect::<Vec<_>>()
        .join("\n");

    let prompt = format!(
        "You are updating repository docs after harness changes.\n\nUse ONLY these staged and committed paths as source-of-truth input. Ignore any unstaged workspace edits:\n{changed_list}\n\nTasks:\n1) Update docs that describe harness structure and behavior.\n2) Keep edits concise and factual; do not invent files or features.\n3) Update only these documentation targets when needed:\n   - README.md\n   - docs/content/docs/index.mdx\n   - llms.txt\n   - .nexus/context/nexus-cli/**/*.md\n4) Do not modify code files.\n\nAfter editing, stop."
    );

    let harness = read_nexus_harness(repo_root)?;
    println!("docs-sync: running '{}' LLM docs updater...", harness);
    println!("docs-sync: prompt sent to {}:\n{prompt}", harness);

    let status = Command::new(&harness)
        .arg("--prompt")
        .arg(&prompt)
        .current_dir(repo_root)
        .status()
        .map_err(|e| format!("failed to run '{} --prompt': {e}", harness))?;

    if !status.success() {
        return Err(format!(
            "opencode docs update failed with status {}",
            status
                .code()
                .map_or("unknown".to_string(), |code| code.to_string())
        ));
    }

    let harness_input_hash = hash_paths(&harness_paths);

    let head_commit = git_single_line(repo_root, ["rev-parse", "HEAD"])?;
    let generated_at = utc_now_string(repo_root)?;

    save_docs_sync_state(
        repo_root,
        &DocsSyncState {
            docs_path: "docs/content/docs".to_string(),
            last_generated_commit: head_commit,
            generated_at,
            last_harness_input_hash: Some(harness_input_hash),
        },
    )?;

    Ok(())
}

fn read_nexus_harness(repo_root: &Path) -> Result<String, String> {
    let config_path = repo_root.join(".nexus/config.json");
    if !config_path.exists() {
        return Ok("opencode".to_string());
    }

    let content = fs::read_to_string(&config_path)
        .map_err(|e| format!("failed to read {}: {e}", config_path.display()))?;

    let parsed = serde_json::from_str::<serde_json::Value>(&content)
        .map_err(|e| format!("failed to parse {}: {e}", config_path.display()))?;

    let harness = parsed
        .get("harness")
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("opencode");

    Ok(harness.to_string())
}

fn staged_and_committed_paths(
    repo_root: &Path,
    last_generated_commit: Option<&str>,
) -> Result<Vec<String>, String> {
    let mut all_paths = BTreeSet::new();

    for path in git_changed_paths(
        repo_root,
        ["diff", "--cached", "--name-only", "--diff-filter=ACMRTUXB"],
    )? {
        all_paths.insert(path);
    }

    let head_commit = git_single_line(repo_root, ["rev-parse", "HEAD"])?;

    if let Some(last_commit) = last_generated_commit {
        let last_commit_exists = Command::new("git")
            .args([
                "rev-parse",
                "--verify",
                &format!("{last_commit}^{{commit}}"),
            ])
            .current_dir(repo_root)
            .output()
            .map_err(|e| format!("failed to run git command: {e}"))?
            .status
            .success();

        if last_commit_exists && last_commit != head_commit {
            for path in git_changed_paths(
                repo_root,
                [
                    "diff",
                    "--name-only",
                    "--diff-filter=ACMRTUXB",
                    &format!("{last_commit}..HEAD"),
                ],
            )? {
                all_paths.insert(path);
            }

            return Ok(all_paths.into_iter().collect());
        }
    }

    let upstream_ref = git_single_line(
        repo_root,
        [
            "rev-parse",
            "--abbrev-ref",
            "--symbolic-full-name",
            "@{upstream}",
        ],
    )
    .ok();

    if let Some(upstream) = upstream_ref {
        for path in git_changed_paths(
            repo_root,
            [
                "diff",
                "--name-only",
                "--diff-filter=ACMRTUXB",
                &format!("{upstream}...HEAD"),
            ],
        )? {
            all_paths.insert(path);
        }
    } else {
        for path in git_changed_paths(
            repo_root,
            ["show", "--pretty=format:", "--name-only", "HEAD"],
        )? {
            all_paths.insert(path);
        }
    }

    Ok(all_paths.into_iter().collect())
}

fn git_changed_paths<const N: usize>(
    repo_root: &Path,
    args: [&str; N],
) -> Result<Vec<String>, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(repo_root)
        .output()
        .map_err(|e| format!("failed to run git command: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git command failed: {}", stderr.trim()));
    }

    Ok(String::from_utf8_lossy(&output.stdout)
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToOwned::to_owned)
        .collect())
}

fn git_single_line<const N: usize>(repo_root: &Path, args: [&str; N]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(repo_root)
        .output()
        .map_err(|e| format!("failed to run git command: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git command failed: {}", stderr.trim()));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn load_docs_sync_state(repo_root: &Path) -> Result<Option<DocsSyncState>, String> {
    let state_path = repo_root.join(DOCS_SYNC_STATE_PATH);
    if !state_path.exists() {
        return Ok(None);
    }

    let content = fs::read_to_string(&state_path)
        .map_err(|e| format!("failed to read state file {}: {e}", state_path.display()))?;
    let parsed = serde_json::from_str::<DocsSyncState>(&content).map_err(|e| {
        format!(
            "failed to parse docs-sync state {}: {e}",
            state_path.display()
        )
    })?;
    Ok(Some(parsed))
}

fn save_docs_sync_state(repo_root: &Path, state: &DocsSyncState) -> Result<(), String> {
    let state_path = repo_root.join(DOCS_SYNC_STATE_PATH);
    if let Some(parent) = state_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create state directory {}: {e}", parent.display()))?;
    }

    let serialized = serde_json::to_string_pretty(state)
        .map_err(|e| format!("failed to serialize docs-sync state: {e}"))?;
    fs::write(&state_path, format!("{serialized}\n"))
        .map_err(|e| format!("failed to write state file {}: {e}", state_path.display()))
}

fn utc_now_string(repo_root: &Path) -> Result<String, String> {
    let output = Command::new("date")
        .args(["-u", "+%Y-%m-%dT%H:%M:%SZ"])
        .current_dir(repo_root)
        .output()
        .map_err(|e| format!("failed to run date command: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("date command failed: {}", stderr.trim()));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

fn collect_rs_files(src_root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    collect_rs_files_recursive(src_root, &mut files)?;
    files.sort();
    Ok(files)
}

fn collect_rs_files_recursive(dir: &Path, out: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|e| format!("failed to read {}: {e}", dir.display()))? {
        let entry =
            entry.map_err(|e| format!("failed to read dir entry in {}: {e}", dir.display()))?;
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|e| format!("failed to read file type for {}: {e}", path.display()))?;

        if file_type.is_dir() {
            collect_rs_files_recursive(&path, out)?;
            continue;
        }

        if file_type.is_file()
            && path.extension().and_then(|x| x.to_str()) == Some("rs")
            && should_include_in_reference(&path)
        {
            out.push(path);
        }
    }
    Ok(())
}

fn should_include_in_reference(path: &Path) -> bool {
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    file_name != "docs_sync.rs"
}

fn parse_rust_file(
    repo_root: &Path,
    src_root: &Path,
    file: &Path,
) -> Result<Vec<SymbolDoc>, String> {
    let content = fs::read_to_string(file)
        .map_err(|e| format!("failed to read rust file {}: {e}", file.display()))?;
    let relative = file.strip_prefix(repo_root).map_err(|e| {
        format!(
            "failed to compute relative path for {}: {e}",
            file.display()
        )
    })?;
    let source_path = relative.to_string_lossy().replace('\\', "/");

    let module_path = build_module_path(src_root, file)?;
    let mut symbols = Vec::new();

    let mut pending_docs: Vec<String> = Vec::new();
    let mut module_docs: Vec<String> = Vec::new();

    let mut brace_depth: usize = 0;
    let mut impl_stack: Vec<(usize, String)> = Vec::new();

    for raw_line in content.lines() {
        let line = raw_line.trim_start();

        if let Some(doc) = line.strip_prefix("//!") {
            module_docs.push(doc.trim().to_string());
            update_brace_state(line, &mut brace_depth, &mut impl_stack);
            continue;
        }
        if let Some(doc) = line.strip_prefix("///") {
            pending_docs.push(doc.trim().to_string());
            update_brace_state(line, &mut brace_depth, &mut impl_stack);
            continue;
        }

        if let Some(target) = parse_impl_target(line) {
            impl_stack.push((brace_depth + 1, target));
        }

        if let Some((kind, name, signature)) = parse_public_symbol(line) {
            let docs_markdown = take_docs(&mut pending_docs);
            let symbol_path = if kind == "fn" {
                if let Some((_, impl_target)) = impl_stack.last() {
                    format!("crate::{module_path}::{impl_target}::{name}")
                } else {
                    format!("crate::{module_path}::{name}")
                }
            } else {
                format!("crate::{module_path}::{name}")
            };

            symbols.push(SymbolDoc {
                module_path: module_path.clone(),
                kind: kind.to_string(),
                name,
                signature,
                docs_markdown,
                source_path: source_path.clone(),
                symbol_path,
            });
        } else if !line.is_empty() && !line.starts_with("//") {
            pending_docs.clear();
        }

        update_brace_state(line, &mut brace_depth, &mut impl_stack);
    }

    if !module_docs.is_empty() {
        symbols.push(SymbolDoc {
            module_path: module_path.clone(),
            kind: "module".to_string(),
            name: module_path
                .split("::")
                .last()
                .unwrap_or("module")
                .to_string(),
            signature: format!("mod {}", module_path.replace("::", "_")),
            docs_markdown: module_docs.join("\n"),
            source_path,
            symbol_path: format!("crate::{module_path}"),
        });
    }

    Ok(symbols)
}

fn build_module_path(src_root: &Path, file: &Path) -> Result<String, String> {
    let rel = file
        .strip_prefix(src_root)
        .map_err(|e| format!("failed to strip src prefix from {}: {e}", file.display()))?;
    let mut parts = Vec::new();
    for comp in rel.components() {
        let p = comp.as_os_str().to_string_lossy();
        parts.push(p.to_string());
    }

    if let Some(last) = parts.last_mut() {
        if let Some(stripped) = last.strip_suffix(".rs") {
            *last = stripped.to_string();
        }
    }

    if parts.last().map(|x| x.as_str()) == Some("mod") {
        parts.pop();
    }

    if parts.last().map(|x| x.as_str()) == Some("lib")
        || parts.last().map(|x| x.as_str()) == Some("main")
    {
        parts.pop();
    }

    if parts.is_empty() {
        Ok("crate_root".to_string())
    } else {
        Ok(parts.join("::"))
    }
}

fn parse_impl_target(line: &str) -> Option<String> {
    let trimmed = line.trim();
    if !trimmed.starts_with("impl") {
        return None;
    }

    if let Some(pos) = trimmed.find(" for ") {
        let rhs = trimmed[pos + 5..].trim();
        return Some(clean_type_name(rhs));
    }

    let after_impl = trimmed.strip_prefix("impl")?.trim();
    if after_impl.starts_with('<') {
        if let Some(end) = after_impl.find('>') {
            let rest = after_impl[end + 1..].trim();
            return Some(clean_type_name(rest));
        }
    }

    Some(clean_type_name(after_impl))
}

fn clean_type_name(input: &str) -> String {
    let mut s = input
        .split('{')
        .next()
        .unwrap_or(input)
        .split_whitespace()
        .next()
        .unwrap_or("Type")
        .to_string();

    s = s.replace("::", "_");
    s = s.replace('<', "_");
    s = s.replace('>', "");
    s = s.replace(',', "_");
    s
}

fn parse_public_symbol(line: &str) -> Option<(&'static str, String, String)> {
    let trimmed = line.trim();

    if let Some(rest) = trimmed.strip_prefix("pub struct ") {
        let name = parse_ident(rest)?;
        return Some(("struct", name, trimmed.to_string()));
    }
    if let Some(rest) = trimmed.strip_prefix("pub enum ") {
        let name = parse_ident(rest)?;
        return Some(("enum", name, trimmed.to_string()));
    }
    if let Some(rest) = trimmed.strip_prefix("pub trait ") {
        let name = parse_ident(rest)?;
        return Some(("trait", name, trimmed.to_string()));
    }
    if let Some(rest) = trimmed.strip_prefix("pub fn ") {
        let name = parse_ident(rest)?;
        return Some(("fn", name, trimmed.to_string()));
    }

    None
}

fn parse_ident(input: &str) -> Option<String> {
    let mut name = String::new();
    for ch in input.chars() {
        if ch == '_' || ch.is_ascii_alphanumeric() {
            name.push(ch);
        } else {
            break;
        }
    }
    if name.is_empty() {
        None
    } else {
        Some(name)
    }
}

fn take_docs(pending_docs: &mut Vec<String>) -> String {
    if pending_docs.is_empty() {
        "No additional documentation available yet.".to_string()
    } else {
        let out = pending_docs.join("\n");
        pending_docs.clear();
        out
    }
}

fn update_brace_state(line: &str, brace_depth: &mut usize, impl_stack: &mut Vec<(usize, String)>) {
    for ch in line.chars() {
        if ch == '{' {
            *brace_depth += 1;
        } else if ch == '}' {
            if *brace_depth > 0 {
                *brace_depth -= 1;
            }
        }
    }

    while let Some((target_depth, _)) = impl_stack.last() {
        if *brace_depth < *target_depth {
            impl_stack.pop();
        } else {
            break;
        }
    }
}

fn render_reference_tree(reference_root: &Path, symbols: &[SymbolDoc]) -> Result<(), String> {
    fs::create_dir_all(reference_root).map_err(|e| {
        format!(
            "failed to create reference root {}: {e}",
            reference_root.display()
        )
    })?;

    let mut grouped: BTreeMap<String, Vec<SymbolDoc>> = BTreeMap::new();
    for symbol in symbols {
        grouped
            .entry(section_for_module(&symbol.module_path))
            .or_default()
            .push(symbol.clone());
    }

    let mut section_pages = vec!["index".to_string()];
    for (section, items) in grouped {
        let section_dir = reference_root.join(&section);
        fs::create_dir_all(&section_dir).map_err(|e| {
            format!(
                "failed to create section dir {}: {e}",
                section_dir.display()
            )
        })?;

        let mut pages = vec!["index".to_string()];

        let section_intro = format!(
            "---\ntitle: {}\ndescription: Generated {} reference\ngenerated: true\n---\n\nThis section is generated from Rust doc comments.",
            title_case(&section),
            section
        );
        write_file(&section_dir.join("index.mdx"), &section_intro)?;

        let related_map = build_related_map(&items);
        for item in items {
            let slug = symbol_slug(&item);
            let doc = render_symbol_page(
                &item,
                related_map
                    .get(&item.module_path)
                    .cloned()
                    .unwrap_or_default(),
            );
            write_file(&section_dir.join(format!("{slug}.mdx")), &doc)?;
            pages.push(slug);
        }

        section_pages.push(section.clone());
        write_meta_json(
            &section_dir.join("meta.json"),
            &title_case(&section),
            &pages,
        )?;
    }

    write_file(
        &reference_root.join("index.mdx"),
        "---\ntitle: Reference\ndescription: Auto-generated reference documentation\ngenerated: true\n---\n\nReference pages are generated from Rust source documentation comments.",
    )?;
    write_meta_json(
        &reference_root.join("meta.json"),
        "Reference",
        &section_pages,
    )?;

    Ok(())
}

fn build_related_map(items: &[SymbolDoc]) -> BTreeMap<String, Vec<(String, String)>> {
    let mut grouped: BTreeMap<String, Vec<(String, String)>> = BTreeMap::new();
    for item in items {
        grouped
            .entry(item.module_path.clone())
            .or_default()
            .push((item.name.clone(), symbol_slug(item)));
    }

    for links in grouped.values_mut() {
        links.sort();
    }

    grouped
}

fn render_symbol_page(item: &SymbolDoc, related: Vec<(String, String)>) -> String {
    let title = item.name.clone();
    let description = item
        .docs_markdown
        .lines()
        .find(|line| !line.trim().is_empty())
        .unwrap_or("Generated reference page")
        .trim()
        .replace('"', "'");

    let mut out = String::new();
    out.push_str("---\n");
    out.push_str(&format!("title: {title}\n"));
    out.push_str(&format!("description: {description}\n"));
    out.push_str("generated: true\n");
    out.push_str(&format!("source_path: {}\n", item.source_path));
    out.push_str(&format!("symbol_path: {}\n", item.symbol_path));
    out.push_str("---\n\n");

    out.push_str("## Signature\n\n");
    out.push_str("```rust\n");
    out.push_str(&item.signature);
    out.push_str("\n```\n\n");

    out.push_str("## Documentation\n\n");
    out.push_str(&item.docs_markdown);
    out.push_str("\n\n");

    if item.kind == "struct" || item.kind == "enum" || item.kind == "trait" {
        out.push_str("## Fields and Members\n\n");
        out.push_str(
            "Review the signature and source-level documentation for detailed members.\n\n",
        );
    }

    if item.docs_markdown.contains("```") {
        out.push_str("## Examples\n\n");
        out.push_str("Examples are included in the documentation block above.\n\n");
    }

    out.push_str("## Related Items\n\n");
    let mut wrote_related = false;
    for (name, slug) in related {
        if name == item.name {
            continue;
        }
        wrote_related = true;
        out.push_str(&format!("- [{name}](./{slug})\n"));
    }
    if !wrote_related {
        out.push_str("- No related items in this module yet.\n");
    }

    out
}

fn section_for_module(module_path: &str) -> String {
    let root = module_path.split("::").next().unwrap_or("reference");
    slugify(root)
}

fn slugify(input: &str) -> String {
    let mut out = String::new();
    let mut previous_dash = false;
    for ch in input.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch.to_ascii_lowercase());
            previous_dash = false;
        } else if !previous_dash {
            out.push('-');
            previous_dash = true;
        }
    }

    let out = out.trim_matches('-').to_string();
    if out.is_empty() {
        "reference".to_string()
    } else {
        out
    }
}

fn symbol_slug(symbol: &SymbolDoc) -> String {
    let module = symbol.module_path.replace("::", "-").to_lowercase();
    let name = symbol.name.to_lowercase();
    format!("{module}--{name}")
}

fn title_case(value: &str) -> String {
    let mut out = String::new();
    let mut upper = true;
    for ch in value.chars() {
        if ch == '-' || ch == '_' {
            out.push(' ');
            upper = true;
            continue;
        }
        if upper {
            out.extend(ch.to_uppercase());
            upper = false;
        } else {
            out.push(ch);
        }
    }
    out
}

fn write_meta_json(path: &Path, title: &str, pages: &[impl AsRef<str>]) -> Result<(), String> {
    let pages_json = pages
        .iter()
        .map(|p| format!("\"{}\"", p.as_ref()))
        .collect::<Vec<_>>()
        .join(", ");
    let content = format!("{{\n  \"title\": \"{title}\",\n  \"pages\": [{pages_json}]\n}}\n");
    write_file(path, &content)
}

fn ensure_root_meta(docs_root: &Path) -> Result<(), String> {
    let root_meta = docs_root.join("meta.json");
    if root_meta.exists() {
        return Ok(());
    }
    write_meta_json(&root_meta, "Documentation", &["index", "reference"])
}

fn write_file(path: &Path, contents: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("failed to create parent dir {}: {e}", parent.display()))?;
    }
    fs::write(path, normalize_newlines(contents))
        .map_err(|e| format!("failed to write file {}: {e}", path.display()))
}

fn normalize_newlines(input: &str) -> String {
    let mut out = String::with_capacity(input.len() + 1);
    for line in input.lines() {
        out.push_str(line.trim_end());
        out.push('\n');
    }
    if !out.ends_with('\n') {
        out.push('\n');
    }
    out
}

fn diff_trees(expected_root: &Path, actual_root: &Path) -> Result<Vec<String>, String> {
    let expected = collect_files_with_contents(expected_root)?;
    let actual = collect_files_with_contents(actual_root)?;

    let mut all_paths: BTreeSet<String> = BTreeSet::new();
    all_paths.extend(expected.keys().cloned());
    all_paths.extend(actual.keys().cloned());

    let mut diffs = Vec::new();
    for path in all_paths {
        let left = expected.get(&path);
        let right = actual.get(&path);
        match (left, right) {
            (None, Some(_)) => diffs.push(format!("missing generated file: {path}")),
            (Some(_), None) => diffs.push(format!("stale file should be removed: {path}")),
            (Some(l), Some(r)) if l != r => diffs.push(format!("content mismatch: {path}")),
            _ => {}
        }
    }

    Ok(diffs)
}

fn collect_files_with_contents(root: &Path) -> Result<BTreeMap<String, String>, String> {
    let mut files = BTreeMap::new();
    if !root.exists() {
        return Ok(files);
    }
    collect_files_recursive(root, root, &mut files)?;
    Ok(files)
}

fn collect_files_recursive(
    root: &Path,
    current: &Path,
    out: &mut BTreeMap<String, String>,
) -> Result<(), String> {
    for entry in fs::read_dir(current)
        .map_err(|e| format!("failed to read directory {}: {e}", current.display()))?
    {
        let entry = entry.map_err(|e| {
            format!(
                "failed to read directory entry in {}: {e}",
                current.display()
            )
        })?;
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|e| format!("failed to read file type for {}: {e}", path.display()))?;
        if file_type.is_dir() {
            collect_files_recursive(root, &path, out)?;
        } else if file_type.is_file() {
            let rel = path
                .strip_prefix(root)
                .map_err(|e| format!("failed to strip prefix for {}: {e}", path.display()))?
                .to_string_lossy()
                .replace('\\', "/");
            let data = fs::read_to_string(&path)
                .map_err(|e| format!("failed to read generated file {}: {e}", path.display()))?;
            out.insert(rel, data);
        }
    }
    Ok(())
}
