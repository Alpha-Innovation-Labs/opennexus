//! Update command for upgrading OpenNexus via cargo.

use anyhow::{Context, Result};
use std::process::Command;

use crate::cli::OutputFormat;
use crate::output::{print_error, print_info, print_success};

/// Run the update command.
pub fn run_update(format: OutputFormat) -> Result<()> {
    if format == OutputFormat::Json {
        println!(r#"{{"status":"starting","command":"cargo install opennexus --bin opennexus"}}"#);
    } else {
        print_info("Updating OpenNexus via cargo...");
    }

    let status = Command::new("cargo")
        .args(["install", "opennexus", "--bin", "opennexus", "--force"])
        .status()
        .context("Failed to run cargo. Is Rust/cargo installed?")?;

    if status.success() {
        if format == OutputFormat::Json {
            println!(r#"{{"status":"completed"}}"#);
        } else {
            print_success("OpenNexus updated successfully");
        }
        Ok(())
    } else {
        if format == OutputFormat::Json {
            println!(
                r#"{{"status":"failed","message":"cargo install returned non-zero exit code"}}"#
            );
        } else {
            print_error("Update failed: cargo install returned non-zero exit code");
        }
        anyhow::bail!("Update failed")
    }
}
