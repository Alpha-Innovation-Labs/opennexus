//! Ralph command passthrough.

use anyhow::{Context, Result};
use std::io;
use std::process::Command;

/// Run the external Ralph CLI with passthrough arguments.
pub fn run_ralph(args: &[String]) -> Result<()> {
    let binary = std::env::var("OPENNEXUS_RALPH_BIN").unwrap_or_else(|_| "ralph".to_string());

    let status = match Command::new(&binary).args(args).status() {
        Ok(status) => status,
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            anyhow::bail!(
                "Ralph binary not found ('{binary}'). Install ralph or set OPENNEXUS_RALPH_BIN to the executable path."
            )
        }
        Err(error) => {
            return Err(error).with_context(|| format!("Failed to launch Ralph binary '{binary}'"));
        }
    };

    match status.code() {
        Some(0) => Ok(()),
        Some(code) => {
            std::process::exit(code);
        }
        None => anyhow::bail!("Ralph process terminated by signal"),
    }
}
