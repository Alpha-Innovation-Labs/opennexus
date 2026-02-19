//! Nexus CLI entry point.

use anyhow::Result;

mod cli;
mod commands;
mod output;

use cli::{Cli, Commands};
use commands::{run_setup, run_uninstall, run_update};

fn main() -> Result<()> {
    // Parse CLI arguments
    let cli = Cli::parse_args();
    let format = cli.format;

    // Route to appropriate command handler
    let result = match cli.command {
        None | Some(Commands::Setup) => run_setup(format),
        Some(Commands::Update) => run_update(format),
        Some(Commands::Uninstall) => run_uninstall(format),
    };

    result
}
