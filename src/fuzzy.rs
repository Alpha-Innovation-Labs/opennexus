//! Fuzzy finder for no-args mode.
//!
//! When the CLI is invoked without arguments, this module provides
//! a fuzzy finder to select a context or action.

use anyhow::{Context, Result};
use skim::prelude::*;
use std::io::Cursor;
use std::path::{Path, PathBuf};

use crate::cli::OutputFormat;
use crate::output::{print_error, print_info};

/// Item type for the fuzzy finder.
#[derive(Debug, Clone)]
pub enum FuzzyItem {
    Context {
        id: String,
        project: String,
        title: String,
        #[allow(dead_code)]
        path: String,
    },
    Action {
        context_id: String,
        test_name: String,
        description: String,
    },
    Command {
        name: String,
        description: String,
    },
}

impl FuzzyItem {
    /// Format for display in the fuzzy finder.
    fn display(&self) -> String {
        match self {
            FuzzyItem::Context {
                id,
                project,
                title,
                path,
            } => {
                format!("{}\t{}-{}.md ({})", path, id, title, project)
            }
            FuzzyItem::Action {
                context_id,
                test_name,
                description,
            } => {
                format!("[{}] {} - {}", context_id, test_name, description)
            }
            FuzzyItem::Command { name, description } => {
                format!("[CMD] {} - {}", name, description)
            }
        }
    }
}

/// Run the fuzzy finder in no-args mode.
pub fn run_fuzzy_finder(format: OutputFormat) -> Result<Option<FuzzyItem>> {
    if format == OutputFormat::Json {
        print_error("Fuzzy finder not available in JSON mode");
        print_info("Use specific commands with arguments instead");
        return Ok(None);
    }

    // Collect items for the fuzzy finder
    let items = collect_fuzzy_items()?;

    if items.is_empty() {
        print_info("No items found. Run 'nexus setup' to initialize.");
        return Ok(None);
    }

    // Format items for skim
    let item_strings: Vec<String> = items.iter().map(|i| i.display()).collect();
    let input = item_strings.join("\n");

    // Configure skim
    let options = SkimOptionsBuilder::default()
        .height(Some("50%"))
        .multi(false)
        .preview(Some("")) // Disable preview for simplicity
        .prompt(Some("Select > "))
        .build()
        .context("Failed to build skim options")?;

    // Run skim
    let item_reader = SkimItemReader::default();
    let skim_items = item_reader.of_bufread(Cursor::new(input));

    let output = Skim::run_with(&options, Some(skim_items));

    match output {
        Some(out) if !out.is_abort => {
            if let Some(selected) = out.selected_items.first() {
                let selected_str = selected.output().to_string();

                // Find the matching item
                for (i, display) in item_strings.iter().enumerate() {
                    if display == &selected_str {
                        return Ok(Some(items[i].clone()));
                    }
                }
            }
            Ok(None)
        }
        _ => {
            // User cancelled
            Ok(None)
        }
    }
}

/// Collect all items for the fuzzy finder.
fn collect_fuzzy_items() -> Result<Vec<FuzzyItem>> {
    let mut items = Vec::new();

    // Add available commands
    items.push(FuzzyItem::Command {
        name: "setup".to_string(),
        description: "Initialize Nexus in this project".to_string(),
    });
    items.push(FuzzyItem::Command {
        name: "gen-tests".to_string(),
        description: "Generate E2E tests for a context".to_string(),
    });
    items.push(FuzzyItem::Command {
        name: "gen-code".to_string(),
        description: "Generate code to make tests pass".to_string(),
    });
    items.push(FuzzyItem::Command {
        name: "manage".to_string(),
        description: "Interactive context management".to_string(),
    });

    // Scan for contexts if .context directory exists
    let context_dir = Path::new(".context");
    if context_dir.exists() {
        items.extend(scan_contexts(context_dir)?);
    }

    Ok(items)
}

/// Scan the .context directory for contexts.
fn scan_contexts(context_dir: &Path) -> Result<Vec<FuzzyItem>> {
    let mut items = Vec::new();

    // Read all project directories
    for entry in std::fs::read_dir(context_dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.is_dir() {
            let project_name = path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown");

            // Skip reference directories
            if project_name.starts_with('_') {
                continue;
            }

            // Read context files in this project
            for context_entry in std::fs::read_dir(&path)? {
                let context_entry = context_entry?;
                let context_path = context_entry.path();

                if context_path.extension().map(|e| e == "md").unwrap_or(false) {
                    let filename = context_path
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("");

                    // Skip index.md
                    if filename == "index.md" {
                        continue;
                    }

                    // Extract context ID and title from filename
                    // Format: PREFIX_NNN-title.md
                    if let Some((id, title)) = parse_context_filename(filename) {
                        items.push(FuzzyItem::Context {
                            id: id.to_string(),
                            project: project_name.to_string(),
                            title: title.to_string(),
                            path: context_path.to_string_lossy().to_string(),
                        });

                        // Also scan for actions in this context
                        if let Ok(actions) = scan_context_actions(&context_path, &id) {
                            items.extend(actions);
                        }
                    }
                }
            }
        }
    }

    Ok(items)
}

/// Parse a context filename into (id, title).
fn parse_context_filename(filename: &str) -> Option<(&str, &str)> {
    // Remove .md extension
    let name = filename.strip_suffix(".md")?;

    // Split on first hyphen
    let hyphen_pos = name.find('-')?;
    let id = &name[..hyphen_pos];
    let title = &name[hyphen_pos + 1..];

    // Validate ID format (PREFIX_NNN)
    if !id.contains('_') {
        return None;
    }

    Some((id, title))
}

/// Scan a context file for actions.
fn scan_context_actions(context_path: &Path, context_id: &str) -> Result<Vec<FuzzyItem>> {
    let content = std::fs::read_to_string(context_path)?;
    let mut items = Vec::new();

    // Look for Next Actions table
    // Format: | test_name | description | outcome |
    let mut in_table = false;
    let mut header_seen = false;

    for line in content.lines() {
        let line = line.trim();

        if line.starts_with("## Next Actions") || line.starts_with("## Next actions") {
            in_table = true;
            continue;
        }

        if in_table {
            if line.starts_with("##") {
                // New section, stop
                break;
            }

            if line.starts_with('|') && line.ends_with('|') {
                // Table row
                let cells: Vec<&str> = line
                    .trim_matches('|')
                    .split('|')
                    .map(|s| s.trim())
                    .collect();

                if cells.len() >= 2 {
                    let first_cell = cells[0].to_lowercase();

                    // Skip header row (Description | Test | or Test | Description |)
                    if first_cell == "test"
                        || first_cell == "action"
                        || first_cell.contains('-')
                        || first_cell == "description"
                    {
                        header_seen = true;
                        continue;
                    }

                    if header_seen && !cells[0].is_empty() && !cells[1].is_empty() {
                        // Check which column is the test name (shorter values are test names)
                        let (test_name, description) = if cells[0].len() < cells[1].len() {
                            (&cells[0], &cells[1])
                        } else {
                            (&cells[1], &cells[0])
                        };

                        items.push(FuzzyItem::Action {
                            context_id: context_id.to_string(),
                            test_name: test_name.to_string(),
                            description: description.to_string(),
                        });
                    }
                }
            }
        }
    }

    Ok(items)
}

/// Pick a context using fuzzy finder (for gen-tests workflow).
pub fn pick_context() -> Result<Option<FuzzyItem>> {
    let context_items = scan_contexts_only()?;

    if context_items.is_empty() {
        print_info("No context files found. Run 'nexus setup' to initialize.");
        return Ok(None);
    }

    loop {
        let item_strings: Vec<String> = context_items.iter().map(|i| i.display()).collect();
        let input = item_strings.join("\n");

        let options = SkimOptionsBuilder::default()
            .height(Some("50%"))
            .multi(false)
            .preview(Some("cat $(echo '{}' | awk -F'\\t' '{print $1}')"))
            .preview_window(Some("right:50%"))
            .prompt(Some("Select context > "))
            .build()
            .context("Failed to build skim options")?;

        let item_reader = SkimItemReader::default();
        let skim_items = item_reader.of_bufread(Cursor::new(input));

        let output = Skim::run_with(&options, Some(skim_items));

        match output {
            Some(out) if !out.is_abort => {
                if let Some(selected) = out.selected_items.first() {
                    let selected_str = selected.output().to_string();
                    for (i, display) in item_strings.iter().enumerate() {
                        if display == &selected_str {
                            let item = context_items[i].clone();
                            // Skip header items and re-prompt
                            if let FuzzyItem::Command { name, .. } = &item {
                                if name.starts_with("===") {
                                    continue;
                                }
                            }
                            return Ok(Some(item));
                        }
                    }
                }
                return Ok(None);
            }
            _ => return Ok(None),
        }
    }
}

/// Scan only context files (no actions).
fn scan_contexts_only() -> Result<Vec<FuzzyItem>> {
    let mut items = Vec::new();
    let context_dir = Path::new(".context");
    if context_dir.exists() {
        // Read all project directories
        for entry in std::fs::read_dir(context_dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.is_dir() {
                let project_name = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown");

                // Skip reference directories
                if project_name.starts_with('_') {
                    continue;
                }

                // Read context files in this project
                for context_entry in std::fs::read_dir(&path)? {
                    let context_entry = context_entry?;
                    let context_path = context_entry.path();

                    if context_path.extension().map(|e| e == "md").unwrap_or(false) {
                        let filename = context_path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or("");

                        // Skip index.md
                        if filename == "index.md" {
                            continue;
                        }

                        // Verify this is a valid context file by checking for context_id in YAML frontmatter
                        if let Ok(content) = std::fs::read_to_string(&context_path) {
                            if content.contains("context_id:") {
                                // Extract context ID and title from filename
                                if let Some((id, title)) = parse_context_filename(filename) {
                                    // Use relative path for cleaner display in list
                                    items.push(FuzzyItem::Context {
                                        id: id.to_string(),
                                        project: project_name.to_string(),
                                        title: title.to_string(),
                                        path: context_path.to_string_lossy().to_string(),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Sort items: first by prefix alphabetically (CLI, TUI, etc.), then by number (001, 002)
    items.sort_by(|a, b| {
        if let (FuzzyItem::Context { id: id_a, .. }, FuzzyItem::Context { id: id_b, .. }) = (a, b) {
            // Extract prefix and number from IDs like "CLI_001" or "TUI_017"
            if let (Some((prefix_a, num_a)), Some((prefix_b, num_b))) =
                (id_a.split_once('_'), id_b.split_once('_'))
            {
                // Parse numbers
                let num_a_parsed = num_a.parse::<u32>().unwrap_or(999);
                let num_b_parsed = num_b.parse::<u32>().unwrap_or(999);

                // First sort by prefix alphabetically
                match prefix_a.cmp(prefix_b) {
                    std::cmp::Ordering::Equal => {
                        // If prefixes are equal, sort by number
                        num_a_parsed.cmp(&num_b_parsed)
                    }
                    other => other,
                }
            } else {
                a.display().cmp(&b.display())
            }
        } else {
            a.display().cmp(&b.display())
        }
    });

    Ok(items)
}

/// Pick an action from a context with ALL option at the top.
pub fn pick_action(context_id: &str) -> Result<Option<(bool, String)>> {
    let context_path = find_context_path(context_id)?;
    let actions = scan_context_actions(&context_path, context_id)?;

    if actions.is_empty() {
        print_info("No actions found in this context.");
        return Ok(None);
    }

    let mut item_strings = Vec::new();
    let mut all_items = Vec::new();

    item_strings.push("[ALL] Generate all tests".to_string());
    all_items.push((true, "ALL".to_string()));

    for action in &actions {
        let display = action.display();
        item_strings.push(display.clone());
        if let FuzzyItem::Action { test_name, .. } = action {
            all_items.push((false, test_name.clone()));
        }
    }

    let input = item_strings.join("\n");

    let options = SkimOptionsBuilder::default()
        .height(Some("50%"))
        .multi(false)
        .preview(Some(""))
        .prompt(Some("Select action > "))
        .build()
        .context("Failed to build skim options")?;

    let item_reader = SkimItemReader::default();
    let skim_items = item_reader.of_bufread(Cursor::new(input));

    let output = Skim::run_with(&options, Some(skim_items));

    match output {
        Some(out) if !out.is_abort => {
            if let Some(selected) = out.selected_items.first() {
                let selected_str = selected.output().to_string();
                for (i, display) in item_strings.iter().enumerate() {
                    if display == &selected_str {
                        return Ok(Some(all_items[i].clone()));
                    }
                }
            }
            Ok(None)
        }
        _ => Ok(None),
    }
}

/// Show context details without the Next Actions list (for gen-tests workflow).
pub fn show_context_summary(context_id: &str) -> Result<()> {
    let context_path = find_context_path(context_id)?;
    let content = std::fs::read_to_string(&context_path)?;

    // Parse YAML frontmatter and title
    let mut id = context_id.to_string();
    let mut project = "unknown".to_string();
    let mut title = "Unknown".to_string();
    let status = "pending".to_string();
    let mut in_frontmatter = false;

    for line in content.lines() {
        if line.trim() == "---" {
            if !in_frontmatter {
                in_frontmatter = true;
            }
            continue;
        }

        if in_frontmatter {
            if line.starts_with("context_id:") {
                id = line
                    .split(':')
                    .nth(1)
                    .map(|s| s.trim().to_string())
                    .unwrap_or_else(|| context_id.to_string());
            } else if line.starts_with("title:") {
                title = line
                    .split(':')
                    .nth(1)
                    .map(|s| s.trim().to_string())
                    .unwrap_or_else(|| "Unknown".to_string());
            } else if line.starts_with("project:") {
                project = line
                    .split(':')
                    .nth(1)
                    .map(|s| s.trim().to_string())
                    .unwrap_or_else(|| "unknown".to_string());
            }
        } else if line.starts_with("# ") && title == "Unknown" {
            // Extract title from first heading
            let parts = line.split(':').collect::<Vec<_>>();
            if parts.len() >= 2 {
                title = parts[1..].join(":").trim().to_string();
            }
            break;
        }
    }

    crate::output::print_success(&format!("Context: {}", id));
    println!("  Project: {}", project);
    println!("  Title: {}", title);
    println!("  Status: {}", status);
    println!("  Path: {}", context_path.display());
    Ok(())
}

/// Find the file path for a context ID.
fn find_context_path(context_id: &str) -> Result<PathBuf> {
    let context_dir = Path::new(".context");
    if !context_dir.exists() {
        anyhow::bail!(".context directory not found");
    }

    for entry in std::fs::read_dir(context_dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            for context_entry in std::fs::read_dir(&path)? {
                let context_entry = context_entry?;
                let context_path = context_entry.path();
                if context_path.extension().map(|e| e == "md").unwrap_or(false) {
                    if let Some((id, _)) = parse_context_filename(
                        context_path
                            .file_name()
                            .and_then(|n| n.to_str())
                            .unwrap_or(""),
                    ) {
                        if id == context_id {
                            return Ok(context_path);
                        }
                    }
                }
            }
        }
    }
    anyhow::bail!("Context not found: {}", context_id)
}

/// Execute the selected fuzzy item.
pub async fn execute_fuzzy_item(item: FuzzyItem, format: OutputFormat) -> Result<()> {
    match item {
        FuzzyItem::Context { id, project, .. } => {
            print_info(&format!("Selected context: {} ({})", id, project));
            // Could launch gen-tests or show context details
            crate::commands::run_context_show(&id, format).await
        }
        FuzzyItem::Action {
            context_id,
            test_name,
            ..
        } => {
            print_info(&format!(
                "Selected action: {} from {}",
                test_name, context_id
            ));
            // Launch gen-tests for this specific action
            crate::commands::run_gen_tests(
                Some(&context_id),
                Some(&test_name),
                3,     // max_retries
                false, // all
                false, // skip_retries
                false, // debug
                false, // parallel
                format,
            )
            .await
        }
        FuzzyItem::Command { name, .. } => {
            print_info(&format!("Selected command: {}", name));
            print_info(&format!("Run: nexus {}", name));
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_context_filename() {
        assert_eq!(
            parse_context_filename("CLI_001-baseline-cli.md"),
            Some(("CLI_001", "baseline-cli"))
        );
        assert_eq!(
            parse_context_filename("SRV_015-auth-flow.md"),
            Some(("SRV_015", "auth-flow"))
        );
        assert_eq!(parse_context_filename("index.md"), None);
        assert_eq!(parse_context_filename("readme.md"), None);
    }

    #[test]
    fn test_fuzzy_item_display() {
        let ctx = FuzzyItem::Context {
            id: "CLI_001".to_string(),
            project: "nexus-cli".to_string(),
            title: "Baseline CLI".to_string(),
            path: ".context/nexus-cli/CLI_001.md".to_string(),
        };
        assert!(ctx.display().contains("CTX"));
        assert!(ctx.display().contains("nexus-cli"));

        let cmd = FuzzyItem::Command {
            name: "setup".to_string(),
            description: "Initialize Nexus".to_string(),
        };
        assert!(cmd.display().contains("CMD"));
        assert!(cmd.display().contains("setup"));
    }
}
