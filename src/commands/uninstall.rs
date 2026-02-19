//! Uninstall command for removing Nexus via cargo.

use anyhow::{Context, Result};
use std::process::Command;

use crate::cli::OutputFormat;
use crate::output::{print_error, print_info, print_success};

/// Run the uninstall command.
pub fn run_uninstall(format: OutputFormat) -> Result<()> {
    if format == OutputFormat::Json {
        println!(r#"{{"status":"starting","command":"cargo uninstall"}}"#);
    } else {
        print_info("Uninstalling Nexus via cargo...");
    }

    let status = Command::new("cargo")
        .args(["uninstall", "nex-us"])
        .status()
        .context("Failed to run cargo. Is Rust/cargo installed?")?;

    if status.success() {
        if format == OutputFormat::Json {
            println!(r#"{{"status":"completed"}}"#);
        } else {
            print_success("Nexus uninstalled successfully");
        }
        Ok(())
    } else {
        if format == OutputFormat::Json {
            println!(
                r#"{{"status":"failed","message":"cargo uninstall returned non-zero exit code"}}"#
            );
        } else {
            print_error("Uninstall failed: cargo uninstall returned non-zero exit code");
        }
        anyhow::bail!("Uninstall failed")
    }
}
