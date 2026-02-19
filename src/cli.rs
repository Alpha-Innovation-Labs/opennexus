//! CLI argument parsing for the Nexus binary.

use clap::{Parser, Subcommand, ValueEnum};

#[derive(Debug, Parser)]
#[command(name = "nexus")]
#[command(author, version, about, long_about = None)]
#[command(propagate_version = true)]
pub struct Cli {
    /// Subcommand to execute.
    #[command(subcommand)]
    pub command: Option<Commands>,

    /// Output format.
    #[arg(long, global = true, default_value = "text")]
    pub format: OutputFormat,
}

impl Cli {
    pub fn parse_args() -> Self {
        Self::parse()
    }
}

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, ValueEnum)]
pub enum OutputFormat {
    #[default]
    Text,
    Json,
}

#[derive(Debug, Clone, Subcommand)]
pub enum Commands {
    /// Set up Nexus in the current project (extracts .nexus directory).
    Setup,

    /// Update Nexus to the latest published version via cargo.
    Update,

    /// Uninstall Nexus via cargo.
    Uninstall,
}
