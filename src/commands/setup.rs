//! Setup command for initializing OpenNexus in a project.
//!
//! This is a local operation that extracts the bundled .nexus directory
//! (containing commands, skills, rules, and context) to the current working directory.

use anyhow::{Context, Result};
use include_dir::{include_dir, Dir};
use serde_json::{Map, Value};
use std::collections::HashSet;
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::symlink;
use std::path::Path;

use crate::cli::OutputFormat;
use crate::output::{print_info, print_success};

/// Embedded .nexus directory with commands, skills, rules, and context.
static NEXUS_ASSETS: Dir = include_dir!("$CARGO_MANIFEST_DIR/.nexus");

/// Run the setup command.
///
/// This extracts the bundled .nexus directory to the current working directory.
/// Existing files are overwritten to keep assets up to date.
pub fn run_setup(format: OutputFormat, harness: &str) -> Result<()> {
    if format == OutputFormat::Json {
        println!(r#"{{"status": "starting"}}"#);
    } else {
        print_info(&format!("Setting up OpenNexus (harness: {})...", harness));
    }

    // Extract bundled .nexus directory
    extract_nexus_directory(format)?;

    // Persist selected harness configuration
    write_nexus_config(format, harness)?;

    // Sync local marketplace assets into active nexus paths via symlinks
    let (_marketplace_context_links, _marketplace_command_links) =
        sync_local_marketplace_assets(format)?;

    let is_opencode_harness = harness.eq_ignore_ascii_case("opencode");

    if is_opencode_harness {
        // Remove stale command files that no longer exist in embedded assets
        let (_nexus_removed, _opencode_removed) = prune_stale_command_files(format)?;

        // Create symlinks in .opencode/command/ for all nexus commands
        let (_symlinks_created, _symlinks_skipped) = create_command_symlinks(format)?;

        // Remove stale tool files that no longer exist in embedded assets
        let (_nexus_tools_removed, _opencode_tools_removed) = prune_stale_tool_files(format)?;

        // Create symlinks in .opencode/tools/ for all nexus tools
        let (_tool_symlinks_created, _tool_symlinks_replaced) = create_tool_symlinks(format)?;

        // Remove stale skill entries in .opencode/skills
        let (_stale_skill_entries_removed, _missing_embedded_skills) =
            prune_stale_skill_entries(format)?;

        // Create symlinks in .opencode/skills/ for all nexus skills
        let (_skill_symlinks_created, _skill_symlinks_replaced) = create_skill_symlinks(format)?;

        // Remove stale rule entries in .opencode/rules
        let (_stale_rule_entries_removed, _missing_embedded_rules) =
            prune_stale_rule_entries(format)?;

        // Create symlinks in .opencode/rules/ for all nexus rules
        let (_rule_symlinks_created, _rule_symlinks_replaced) = create_rule_symlinks(format)?;
    } else if harness.eq_ignore_ascii_case("claude") {
        let (_created, _replaced) = create_claude_command_symlinks(format)?;
    } else if format != OutputFormat::Json {
        print_info(&format!(
            "Harness '{}' selected: skipped .opencode command/skill/rule linkage",
            harness
        ));
    }

    // Remove legacy .nexus/rules directory if present
    remove_legacy_rules_directory(format)?;

    if format == OutputFormat::Json {
        println!(r#"{{"status": "completed"}}"#);
    } else {
        println!();
        print_success("OpenNexus setup complete!");
    }

    Ok(())
}

fn write_nexus_config(format: OutputFormat, harness: &str) -> Result<()> {
    let config_path = Path::new(".nexus/config.json");

    let mut config = if config_path.exists() {
        let content = fs::read_to_string(config_path)
            .with_context(|| format!("Failed to read '{}'.", config_path.display()))?;
        serde_json::from_str::<Value>(&content).unwrap_or_else(|_| Value::Object(Map::new()))
    } else {
        Value::Object(Map::new())
    };

    if !config.is_object() {
        config = Value::Object(Map::new());
    }

    let obj = config
        .as_object_mut()
        .expect("config object should exist after reset");

    obj.insert("harness".to_string(), Value::String(harness.to_string()));

    let serialized = serde_json::to_string_pretty(&config).context("Failed to serialize config")?;
    fs::write(config_path, format!("{serialized}\n"))
        .with_context(|| format!("Failed to write '{}'.", config_path.display()))?;

    if format != OutputFormat::Json {
        print_success(&format!(
            "Configured harness '{}' in .nexus/config.json",
            harness
        ));
    }

    Ok(())
}

fn sync_local_marketplace_assets(format: OutputFormat) -> Result<(usize, usize)> {
    let marketplace_root = Path::new(".nexus/marketplace");
    if !marketplace_root.exists() {
        return Ok((0, 0));
    }

    let mut context_links = 0;
    let mut command_links = 0;

    let nexus_context_dir = Path::new(".nexus/context");
    let nexus_commands_dir = Path::new(".nexus/ai_harness/commands");
    if !nexus_context_dir.exists() {
        fs::create_dir_all(nexus_context_dir)?;
    }
    if !nexus_commands_dir.exists() {
        fs::create_dir_all(nexus_commands_dir)?;
    }

    for entry in fs::read_dir(marketplace_root)? {
        let entry = entry?;
        let package_path = entry.path();
        if !package_path.is_dir() {
            continue;
        }

        let package_name = match package_path.file_name() {
            Some(name) => name.to_string_lossy().to_string(),
            None => continue,
        };

        let package_context_dir = package_path.join("context");
        if package_context_dir.is_dir() {
            let target = nexus_context_dir.join(&package_name);
            if path_exists_or_symlink(&target) {
                remove_path(&target)?;
            }

            #[cfg(unix)]
            {
                let link_target = format!("../marketplace/{}/context", package_name);
                symlink(&link_target, &target)?;
            }

            #[cfg(not(unix))]
            {
                copy_dir_recursive(&package_context_dir, &target)?;
            }

            context_links += 1;
        }

        let package_commands_dir = package_path.join("commands");
        if package_commands_dir.is_dir() {
            for command_entry in fs::read_dir(&package_commands_dir)? {
                let command_entry = command_entry?;
                let command_source = command_entry.path();
                if !command_source.is_file() {
                    continue;
                }

                let Some(file_name) = command_source
                    .file_name()
                    .map(|name| name.to_string_lossy().to_string())
                else {
                    continue;
                };

                if !is_command_entry_file(&file_name) {
                    continue;
                }

                let command_target = nexus_commands_dir.join(&file_name);
                if path_exists_or_symlink(&command_target) {
                    remove_path(&command_target)?;
                }

                #[cfg(unix)]
                {
                    let link_target =
                        format!("../../marketplace/{}/commands/{}", package_name, file_name);
                    symlink(&link_target, &command_target)?;
                }

                #[cfg(not(unix))]
                {
                    fs::copy(&command_source, &command_target)?;
                }

                command_links += 1;
            }
        }
    }

    if format != OutputFormat::Json && (context_links > 0 || command_links > 0) {
        print_success(&format!(
            "Linked marketplace assets ({} context packages, {} commands)",
            context_links, command_links
        ));
    }

    Ok((context_links, command_links))
}

/// Remove stale command files from .nexus/ai_harness/commands and .opencode/command.
///
/// Any command file not present in the embedded `.nexus/ai_harness/commands` assets is deleted.
fn prune_stale_command_files(format: OutputFormat) -> Result<(usize, usize)> {
    let nexus_commands_dir = Path::new(".nexus/ai_harness/commands");
    let opencode_command_dir = Path::new(".opencode/command");

    if !nexus_commands_dir.exists() {
        return Ok((0, 0));
    }

    let Some(embedded_commands_dir) = NEXUS_ASSETS.get_dir("ai_harness/commands") else {
        return Ok((0, 0));
    };

    let mut allowed_files: HashSet<String> = embedded_commands_dir
        .files()
        .filter_map(|file| file.path().file_name())
        .map(|name| name.to_string_lossy().to_string())
        .collect();

    allowed_files.extend(marketplace_command_file_names()?);

    let mut nexus_removed = 0;
    for entry in fs::read_dir(nexus_commands_dir)? {
        let entry = entry?;
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path)?;

        if metadata.file_type().is_dir() {
            continue;
        }

        let Some(file_name) = path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
        else {
            continue;
        };

        if !is_command_entry_file(&file_name) {
            continue;
        }

        if !allowed_files.contains(&file_name) {
            fs::remove_file(&path)?;
            nexus_removed += 1;
        }
    }

    let mut opencode_removed = 0;
    if opencode_command_dir.exists() {
        for entry in fs::read_dir(opencode_command_dir)? {
            let entry = entry?;
            let path = entry.path();
            let metadata = fs::symlink_metadata(&path)?;

            if metadata.file_type().is_dir() {
                continue;
            }

            let Some(file_name) = path
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
            else {
                continue;
            };

            if !allowed_files.contains(&file_name) {
                fs::remove_file(&path)?;
                opencode_removed += 1;
            }
        }
    }

    if format != OutputFormat::Json && (nexus_removed > 0 || opencode_removed > 0) {
        print_success(&format!(
            "Removed stale commands ({} from .nexus/ai_harness/commands, {} from .opencode/command)",
            nexus_removed, opencode_removed
        ));
    }

    Ok((nexus_removed, opencode_removed))
}

fn marketplace_command_file_names() -> Result<HashSet<String>> {
    let mut names = HashSet::new();
    let marketplace_root = Path::new(".nexus/marketplace");
    if !marketplace_root.exists() {
        return Ok(names);
    }

    for entry in fs::read_dir(marketplace_root)? {
        let entry = entry?;
        let package_path = entry.path();
        if !package_path.is_dir() {
            continue;
        }

        let commands_dir = package_path.join("commands");
        if !commands_dir.is_dir() {
            continue;
        }

        for command_entry in fs::read_dir(commands_dir)? {
            let command_entry = command_entry?;
            let command_path = command_entry.path();
            if !command_path.is_file() {
                continue;
            }

            let Some(file_name) = command_path
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
            else {
                continue;
            };

            if is_command_entry_file(&file_name) {
                names.insert(file_name);
            }
        }
    }

    Ok(names)
}

fn create_claude_command_symlinks(format: OutputFormat) -> Result<(usize, usize)> {
    let claude_command_dir = Path::new(".claude/commands");
    let nexus_commands_dir = Path::new(".nexus/ai_harness/commands");

    if !nexus_commands_dir.exists() {
        return Ok((0, 0));
    }

    if !claude_command_dir.exists() {
        fs::create_dir_all(claude_command_dir)?;
    }

    let mut symlinks_created = 0;
    let mut symlinks_replaced = 0;

    for entry in fs::read_dir(nexus_commands_dir)? {
        let entry = entry?;
        let source_path = entry.path();

        if !source_path.is_file() {
            continue;
        }

        let file_name = match source_path.file_name() {
            Some(name) => name,
            None => continue,
        };

        let file_name_str = file_name.to_string_lossy().to_string();
        if !is_command_entry_file(&file_name_str) {
            continue;
        }

        let symlink_path = claude_command_dir.join(file_name);

        if path_exists_or_symlink(&symlink_path) {
            remove_path(&symlink_path)?;
            symlinks_replaced += 1;
        }

        let target = format!("../../.nexus/ai_harness/commands/{}", file_name_str);

        #[cfg(unix)]
        symlink(&target, &symlink_path)?;
        #[cfg(not(unix))]
        fs::copy(&source_path, &symlink_path)?;

        symlinks_created += 1;
    }

    if format != OutputFormat::Json && (symlinks_created > 0 || symlinks_replaced > 0) {
        print_success(&format!(
            "Created {} symlinks in .claude/commands/ ({} replaced)",
            symlinks_created, symlinks_replaced
        ));
    }

    Ok((symlinks_created, symlinks_replaced))
}

/// Extract the bundled .nexus directory to the current working directory.
///
/// This recursively extracts all files and directories from the embedded
/// NEXUS_ASSETS to `.nexus/` in the current directory. Existing files
/// are overwritten to keep assets up to date.
fn extract_nexus_directory(format: OutputFormat) -> Result<()> {
    let nexus_dir = Path::new(".nexus");
    let dir_exists = nexus_dir.exists();

    if !dir_exists {
        fs::create_dir_all(nexus_dir)?;
    }

    // Always write/update the version file
    let version_file = nexus_dir.join(".version");
    let version = env!("CARGO_PKG_VERSION");
    fs::write(&version_file, version).context("Failed to write .nexus/.version")?;

    // Extract all files from the embedded directory
    let mut files_written = 0;
    let mut files_replaced = 0;

    let context_dir = nexus_dir.join("context");
    if !context_dir.exists() {
        fs::create_dir_all(&context_dir)?;
    }

    extract_dir_recursive(
        &NEXUS_ASSETS,
        nexus_dir,
        &mut files_written,
        &mut files_replaced,
        true,
    )?;

    if format != OutputFormat::Json {
        if dir_exists && files_written == 0 {
            print_info(&format!(
                ".nexus directory already exists ({} files replaced, version updated)",
                files_replaced
            ));
        } else if files_written > 0 {
            print_success(&format!(
                "Extracted {} files to .nexus ({} replaced)",
                files_written, files_replaced
            ));
        } else {
            print_success("Created .nexus directory");
        }
    }

    Ok(())
}

/// Recursively extract files from an embedded directory.
fn extract_dir_recursive(
    dir: &Dir,
    target_path: &Path,
    files_written: &mut usize,
    files_replaced: &mut usize,
    is_root: bool,
) -> Result<()> {
    // Create the target directory if it doesn't exist
    if !target_path.exists() {
        fs::create_dir_all(target_path)?;
    }

    // Extract all files in this directory
    for file in dir.files() {
        let file_path = target_path.join(file.path().file_name().unwrap_or_default());

        if file_path.exists() {
            *files_replaced += 1;
        }

        fs::write(&file_path, file.contents())?;
        *files_written += 1;
    }

    // Recursively extract subdirectories
    for subdir in dir.dirs() {
        let subdir_name = subdir.path().file_name().unwrap_or_default();
        let subdir_path = target_path.join(subdir_name);

        if is_root && subdir_name == "context" {
            extract_allowed_context_projects(subdir, &subdir_path, files_written, files_replaced)?;
            continue;
        }

        extract_dir_recursive(subdir, &subdir_path, files_written, files_replaced, false)?;
    }

    Ok(())
}

fn extract_allowed_context_projects(
    context_dir: &Dir,
    target_context_path: &Path,
    files_written: &mut usize,
    files_replaced: &mut usize,
) -> Result<()> {
    if !target_context_path.exists() {
        fs::create_dir_all(target_context_path)?;
    }

    let allowlist = context_projects_allowlist();

    for source in context_dir.dirs() {
        let project = source
            .path()
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        if !allowlist.iter().any(|allowed| allowed == &project) {
            continue;
        }

        let target = target_context_path.join(&project);
        extract_dir_recursive(source, &target, files_written, files_replaced, false)?;
    }

    Ok(())
}

fn context_projects_allowlist() -> Vec<String> {
    let default: Vec<String> = Vec::new();

    let allowlist_file = match NEXUS_ASSETS.get_file("context/.extract-allowlist") {
        Some(file) => file,
        None => return default,
    };

    match std::str::from_utf8(allowlist_file.contents()) {
        Ok(content) => {
            let entries: Vec<String> = content
                .lines()
                .map(str::trim)
                .filter(|line| !line.is_empty() && !line.starts_with('#'))
                .map(ToOwned::to_owned)
                .collect();
            if entries.is_empty() {
                Vec::new()
            } else {
                entries
            }
        }
        Err(_) => default,
    }
}

/// Create symlinks in .opencode/command/ for all files in .nexus/ai_harness/commands/.
fn create_command_symlinks(format: OutputFormat) -> Result<(usize, usize)> {
    let opencode_command_dir = Path::new(".opencode/command");
    let nexus_commands_dir = Path::new(".nexus/ai_harness/commands");

    if !nexus_commands_dir.exists() {
        return Ok((0, 0));
    }

    if !opencode_command_dir.exists() {
        fs::create_dir_all(opencode_command_dir)?;
    }

    let mut symlinks_created = 0;
    let mut symlinks_replaced = 0;

    for entry in fs::read_dir(nexus_commands_dir)? {
        let entry = entry?;
        let source_path = entry.path();

        if !source_path.is_file() {
            continue;
        }

        let file_name = match source_path.file_name() {
            Some(name) => name,
            None => continue,
        };

        let symlink_path = opencode_command_dir.join(file_name);

        if path_exists_or_symlink(&symlink_path) {
            remove_path(&symlink_path)?;
            symlinks_replaced += 1;
        }

        let target = format!(
            "../../.nexus/ai_harness/commands/{}",
            file_name.to_string_lossy()
        );

        #[cfg(unix)]
        symlink(&target, &symlink_path)?;
        #[cfg(not(unix))]
        std::fs::copy(&source_path, &symlink_path)?;

        symlinks_created += 1;
    }

    if format != OutputFormat::Json && (symlinks_created > 0 || symlinks_replaced > 0) {
        print_success(&format!(
            "Created {} symlinks in .opencode/command/ ({} replaced)",
            symlinks_created, symlinks_replaced
        ));
    }

    Ok((symlinks_created, symlinks_replaced))
}

/// Remove stale tool files from .nexus/tools and stale nexus-managed entries from .opencode/tools.
fn prune_stale_tool_files(format: OutputFormat) -> Result<(usize, usize)> {
    let nexus_tools_dir = Path::new(".nexus/tools");
    let opencode_tools_dir = Path::new(".opencode/tools");

    if !nexus_tools_dir.exists() {
        return Ok((0, 0));
    }

    let Some(embedded_tools_dir) = NEXUS_ASSETS.get_dir("tools") else {
        return Ok((0, 0));
    };

    let allowed_files: HashSet<String> = embedded_tools_dir
        .files()
        .filter_map(|file| file.path().file_name())
        .map(|name| name.to_string_lossy().to_string())
        .filter(|name| is_tool_entry_file(name))
        .collect();

    let mut nexus_removed = 0;
    for entry in fs::read_dir(nexus_tools_dir)? {
        let entry = entry?;
        let path = entry.path();
        let metadata = fs::symlink_metadata(&path)?;

        if metadata.file_type().is_dir() {
            continue;
        }

        let Some(file_name) = path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
        else {
            continue;
        };

        if !allowed_files.contains(&file_name) {
            fs::remove_file(&path)?;
            nexus_removed += 1;
        }
    }

    let mut opencode_removed = 0;
    if opencode_tools_dir.exists() {
        for entry in fs::read_dir(opencode_tools_dir)? {
            let entry = entry?;
            let path = entry.path();
            let metadata = fs::symlink_metadata(&path)?;

            if metadata.file_type().is_dir() {
                continue;
            }

            let Some(file_name) = path
                .file_name()
                .map(|name| name.to_string_lossy().to_string())
            else {
                continue;
            };

            if !allowed_files.contains(&file_name) {
                continue;
            }

            if metadata.file_type().is_symlink() {
                fs::remove_file(&path)?;
                opencode_removed += 1;
                continue;
            }

            // Preserve user-managed regular files.
            if path.is_file() {
                continue;
            }
        }
    }

    if format != OutputFormat::Json && (nexus_removed > 0 || opencode_removed > 0) {
        print_success(&format!(
            "Removed stale tools ({} from .nexus/tools, {} from .opencode/tools)",
            nexus_removed, opencode_removed
        ));
    }

    Ok((nexus_removed, opencode_removed))
}

/// Create symlinks in .opencode/tools/ for all files in .nexus/tools/.
fn create_tool_symlinks(format: OutputFormat) -> Result<(usize, usize)> {
    let opencode_tools_dir = Path::new(".opencode/tools");
    let nexus_tools_dir = Path::new(".nexus/tools");

    if !nexus_tools_dir.exists() {
        return Ok((0, 0));
    }

    if !opencode_tools_dir.exists() {
        fs::create_dir_all(opencode_tools_dir)?;
    }

    let mut symlinks_created = 0;
    let mut symlinks_replaced = 0;

    for entry in fs::read_dir(nexus_tools_dir)? {
        let entry = entry?;
        let source_path = entry.path();

        if !source_path.is_file() {
            continue;
        }

        let file_name = match source_path.file_name() {
            Some(name) => name,
            None => continue,
        };

        let file_name_str = file_name.to_string_lossy().to_string();
        if !is_tool_entry_file(&file_name_str) {
            continue;
        }

        let symlink_path = opencode_tools_dir.join(file_name);

        if path_exists_or_symlink(&symlink_path) {
            remove_path(&symlink_path)?;
            symlinks_replaced += 1;
        }

        let target = format!("../../.nexus/tools/{}", file_name.to_string_lossy());

        #[cfg(unix)]
        symlink(&target, &symlink_path)?;
        #[cfg(not(unix))]
        std::fs::copy(&source_path, &symlink_path)?;

        symlinks_created += 1;
    }

    if format != OutputFormat::Json && (symlinks_created > 0 || symlinks_replaced > 0) {
        print_success(&format!(
            "Created {} symlinks in .opencode/tools/ ({} replaced)",
            symlinks_created, symlinks_replaced
        ));
    }

    Ok((symlinks_created, symlinks_replaced))
}

fn is_tool_entry_file(file_name: &str) -> bool {
    let has_supported_extension = file_name.ends_with(".ts")
        || file_name.ends_with(".js")
        || file_name.ends_with(".mjs")
        || file_name.ends_with(".cjs");

    if !has_supported_extension {
        return false;
    }

    if file_name.starts_with('_') {
        return false;
    }

    if file_name.ends_with(".test.ts")
        || file_name.ends_with(".spec.ts")
        || file_name.ends_with(".test.js")
        || file_name.ends_with(".spec.js")
    {
        return false;
    }

    true
}

fn is_command_entry_file(file_name: &str) -> bool {
    if !file_name.ends_with(".md") {
        return false;
    }

    if file_name.starts_with('_') {
        return false;
    }

    true
}

fn path_exists_or_symlink(path: &Path) -> bool {
    path.exists() || fs::symlink_metadata(path).is_ok()
}

/// Remove legacy top-level .nexus/rules directory.
fn remove_legacy_rules_directory(format: OutputFormat) -> Result<bool> {
    let rules_dir = Path::new(".nexus/rules");

    if !rules_dir.exists() {
        return Ok(false);
    }

    fs::remove_dir_all(rules_dir)?;

    if format != OutputFormat::Json {
        print_success("Removed legacy .nexus/rules directory");
    }

    Ok(true)
}

/// Remove stale rule entries from .opencode/rules that are no longer in embedded assets.
fn prune_stale_rule_entries(format: OutputFormat) -> Result<(usize, bool)> {
    let opencode_rules_dir = Path::new(".opencode/rules");
    if !opencode_rules_dir.exists() {
        return Ok((0, false));
    }

    let Some(embedded_rules_dir) = NEXUS_ASSETS.get_dir("ai_harness/rules") else {
        return Ok((0, true));
    };

    let allowed_dirs: HashSet<String> = embedded_rules_dir
        .dirs()
        .filter_map(|dir| dir.path().file_name())
        .map(|name| name.to_string_lossy().to_string())
        .collect();

    let mut removed = 0;
    for entry in fs::read_dir(opencode_rules_dir)? {
        let entry = entry?;
        let path = entry.path();
        let Some(name) = path
            .file_name()
            .map(|file_name| file_name.to_string_lossy().to_string())
        else {
            continue;
        };

        if allowed_dirs.contains(&name) {
            continue;
        }

        remove_path(&path)?;
        removed += 1;
    }

    if format != OutputFormat::Json && removed > 0 {
        print_success(&format!(
            "Removed {} stale entries from .opencode/rules",
            removed
        ));
    }

    Ok((removed, false))
}

/// Remove stale skill entries from .opencode/skills that are no longer in embedded assets.
fn prune_stale_skill_entries(format: OutputFormat) -> Result<(usize, bool)> {
    let opencode_skills_dir = Path::new(".opencode/skills");
    if !opencode_skills_dir.exists() {
        return Ok((0, false));
    }

    let Some(embedded_skills_dir) = NEXUS_ASSETS.get_dir("ai_harness/skills") else {
        return Ok((0, true));
    };

    let allowed_dirs: HashSet<String> = embedded_skills_dir
        .dirs()
        .filter_map(|dir| dir.path().file_name())
        .map(|name| name.to_string_lossy().to_string())
        .collect();

    let mut removed = 0;
    for entry in fs::read_dir(opencode_skills_dir)? {
        let entry = entry?;
        let path = entry.path();
        let Some(name) = path
            .file_name()
            .map(|file_name| file_name.to_string_lossy().to_string())
        else {
            continue;
        };

        if allowed_dirs.contains(&name) {
            continue;
        }

        remove_path(&path)?;
        removed += 1;
    }

    if format != OutputFormat::Json && removed > 0 {
        print_success(&format!(
            "Removed {} stale entries from .opencode/skills",
            removed
        ));
    }

    Ok((removed, false))
}

/// Create symlinks in .opencode/skills/ for all directories in .nexus/ai_harness/skills/.
fn create_skill_symlinks(format: OutputFormat) -> Result<(usize, usize)> {
    let opencode_skills_dir = Path::new(".opencode/skills");
    let nexus_skills_dir = Path::new(".nexus/ai_harness/skills");

    if !nexus_skills_dir.exists() {
        return Ok((0, 0));
    }

    if !opencode_skills_dir.exists() {
        fs::create_dir_all(opencode_skills_dir)?;
    }

    let mut symlinks_created = 0;
    let mut symlinks_replaced = 0;

    for entry in fs::read_dir(nexus_skills_dir)? {
        let entry = entry?;
        let source_path = entry.path();
        if !source_path.is_dir() {
            continue;
        }

        let skill_name = match source_path.file_name() {
            Some(name) => name,
            None => continue,
        };

        let skill_file = source_path.join("SKILL.md");
        if !skill_file.exists() {
            continue;
        }

        let symlink_path = opencode_skills_dir.join(skill_name);

        if path_exists_or_symlink(&symlink_path) {
            remove_path(&symlink_path)?;
            symlinks_replaced += 1;
        }

        let target = format!(
            "../../.nexus/ai_harness/skills/{}",
            skill_name.to_string_lossy()
        );

        #[cfg(unix)]
        symlink(&target, &symlink_path)?;

        #[cfg(not(unix))]
        {
            fs::create_dir_all(&symlink_path)?;
            fs::copy(&skill_file, symlink_path.join("SKILL.md"))?;
        }

        symlinks_created += 1;
    }

    if format != OutputFormat::Json && (symlinks_created > 0 || symlinks_replaced > 0) {
        print_success(&format!(
            "Created {} symlinks in .opencode/skills/ ({} replaced)",
            symlinks_created, symlinks_replaced
        ));
    }

    Ok((symlinks_created, symlinks_replaced))
}

/// Create symlinks in .opencode/rules/ for all directories in .nexus/ai_harness/rules/.
fn create_rule_symlinks(format: OutputFormat) -> Result<(usize, usize)> {
    let opencode_rules_dir = Path::new(".opencode/rules");
    let nexus_rules_dir = Path::new(".nexus/ai_harness/rules");

    if !nexus_rules_dir.exists() {
        return Ok((0, 0));
    }

    if !opencode_rules_dir.exists() {
        fs::create_dir_all(opencode_rules_dir)?;
    }

    let mut symlinks_created = 0;
    let mut symlinks_replaced = 0;

    for entry in fs::read_dir(nexus_rules_dir)? {
        let entry = entry?;
        let source_path = entry.path();
        if !source_path.is_dir() {
            continue;
        }

        let rule_name = match source_path.file_name() {
            Some(name) => name,
            None => continue,
        };

        let rule_file = source_path.join("RULE.md");
        let legacy_skill_file = source_path.join("SKILL.md");
        if !rule_file.exists() && !legacy_skill_file.exists() {
            continue;
        }

        let symlink_path = opencode_rules_dir.join(rule_name);

        if path_exists_or_symlink(&symlink_path) {
            remove_path(&symlink_path)?;
            symlinks_replaced += 1;
        }

        let target = format!(
            "../../.nexus/ai_harness/rules/{}",
            rule_name.to_string_lossy()
        );

        #[cfg(unix)]
        symlink(&target, &symlink_path)?;

        #[cfg(not(unix))]
        {
            fs::create_dir_all(&symlink_path)?;
            if rule_file.exists() {
                fs::copy(&rule_file, symlink_path.join("RULE.md"))?;
            }
            if legacy_skill_file.exists() {
                fs::copy(&legacy_skill_file, symlink_path.join("SKILL.md"))?;
            }
        }

        symlinks_created += 1;
    }

    if format != OutputFormat::Json && (symlinks_created > 0 || symlinks_replaced > 0) {
        print_success(&format!(
            "Created {} symlinks in .opencode/rules/ ({} replaced)",
            symlinks_created, symlinks_replaced
        ));
    }

    Ok((symlinks_created, symlinks_replaced))
}

fn remove_path(path: &Path) -> Result<()> {
    let metadata = fs::symlink_metadata(path)?;
    if metadata.file_type().is_dir() {
        fs::remove_dir_all(path)?;
    } else {
        fs::remove_file(path)?;
    }
    Ok(())
}
