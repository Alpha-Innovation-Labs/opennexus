//! Setup command for initializing Nexus in a project.
//!
//! This is a local operation that extracts the bundled .nexus directory
//! (containing commands, rules, and templates) to the current working directory.

use anyhow::{Context, Result};
use include_dir::{include_dir, Dir};
use std::fs;
#[cfg(unix)]
use std::os::unix::fs::symlink;
use std::path::Path;

use crate::cli::OutputFormat;
use crate::output::{print_info, print_success};

/// Embedded .nexus directory with commands, rules, and templates.
static NEXUS_ASSETS: Dir = include_dir!("$CARGO_MANIFEST_DIR/.nexus");

/// Run the setup command.
///
/// This extracts the bundled .nexus directory to the current working directory.
/// Existing files are overwritten to keep assets up to date.
pub fn run_setup(format: OutputFormat) -> Result<()> {
    if format == OutputFormat::Json {
        println!(r#"{{"status": "starting"}}"#);
    } else {
        print_info("Setting up Nexus...");
    }

    // Extract bundled .nexus directory
    extract_nexus_directory(format)?;

    // Create symlinks in .opencode/command/ for all nexus commands
    let (_symlinks_created, _symlinks_skipped) = create_command_symlinks(format)?;

    if format == OutputFormat::Json {
        println!(r#"{{"status": "completed"}}"#);
    } else {
        println!();
        print_success("Nexus setup complete!");
    }

    Ok(())
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
            if !subdir_path.exists() {
                fs::create_dir_all(&subdir_path)?;
            }
            continue;
        }

        extract_dir_recursive(subdir, &subdir_path, files_written, files_replaced, false)?;
    }

    Ok(())
}

/// Create symlinks in .opencode/command/ for all files in .nexus/commands/.
fn create_command_symlinks(format: OutputFormat) -> Result<(usize, usize)> {
    let opencode_command_dir = Path::new(".opencode/command");
    let nexus_commands_dir = Path::new(".nexus/commands");

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

        if symlink_path.exists() {
            fs::remove_file(&symlink_path)?;
            symlinks_replaced += 1;
        }

        let target = format!("../../.nexus/commands/{}", file_name.to_string_lossy());

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
