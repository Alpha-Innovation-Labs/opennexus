//! Nexus CLI - setup-only entry point.

use anyhow::Result;

mod cli;
mod commands;
mod output;

use cli::{Cli, Commands};
use commands::run_setup;

fn main() -> Result<()> {
    // Parse CLI arguments
    let cli = Cli::parse_args();
    let format = cli.format;

    // Route to appropriate command handler
    let result = match cli.command {
        None | Some(Commands::Setup) => run_setup(format),
    };

    result
}
