use std::collections::{BTreeMap, BTreeSet};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

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
}

fn main() {
    if let Err(err) = run() {
        eprintln!("docs-sync error: {err}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let mode = match env::args().nth(1).as_deref() {
        None | Some("sync") => Mode::Sync,
        Some("check") => Mode::Check,
        Some(other) => {
            return Err(format!(
                "unknown mode '{other}'. use: docs-sync [sync|check]"
            ));
        }
    };

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
    }
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

        if file_type.is_file() && path.extension().and_then(|x| x.to_str()) == Some("rs") {
            out.push(path);
        }
    }
    Ok(())
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
            .entry(category_for_module(&symbol.module_path).to_string())
            .or_default()
            .push(symbol.clone());
    }

    let categories = ["core", "primitives", "exchanges"];
    for category in categories {
        let category_dir = reference_root.join(category);
        fs::create_dir_all(&category_dir).map_err(|e| {
            format!(
                "failed to create category dir {}: {e}",
                category_dir.display()
            )
        })?;

        let items = grouped.get(category).cloned().unwrap_or_default();
        let mut pages = vec!["index".to_string()];

        let category_intro = format!(
            "---\ntitle: {}\ndescription: Generated {} reference\ngenerated: true\n---\n\nThis section is generated from Rust doc comments.",
            title_case(category),
            category
        );
        write_file(&category_dir.join("index.mdx"), &category_intro)?;

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
            write_file(&category_dir.join(format!("{slug}.mdx")), &doc)?;
            pages.push(slug);
        }

        write_meta_json(
            &category_dir.join("meta.json"),
            &title_case(category),
            &pages,
        )?;
    }

    write_file(
        &reference_root.join("index.mdx"),
        "---\ntitle: Reference\ndescription: Auto-generated API and symbol documentation\ngenerated: true\n---\n\nReference pages are generated from Rust source documentation comments.",
    )?;
    write_meta_json(
        &reference_root.join("meta.json"),
        "Reference",
        &["index", "core", "primitives", "exchanges"],
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

fn category_for_module(module_path: &str) -> &'static str {
    if module_path.contains("exchange") {
        "exchanges"
    } else if module_path.starts_with("commands") || module_path.starts_with("bin") {
        "core"
    } else {
        "primitives"
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
