//! Nexus CLI entry point.

use anyhow::Result;
use clap::CommandFactory;

mod adapters;
mod app;
mod cli;
mod commands;
mod config;
mod core;
mod features;
mod output;
mod services;
mod utils;

use cli::{Cli, Commands, ContextCommands, MarketplaceCommands};
use commands::{
    resolve_setup_harness, run_context_backfill, run_context_implement, run_context_test_status,
    run_marketplace_install, run_marketplace_search, run_ralph, run_setup, run_uninstall,
    run_update,
};

fn main() -> Result<()> {
    // Parse CLI arguments
    let cli = Cli::parse_args();
    let format = cli.format;

    // Route to appropriate command handler
    let result = match cli.command {
        None => {
            let mut cmd = Cli::command();
            cmd.print_long_help()?;
            println!();
            Ok(())
        }
        Some(Commands::Setup { harness }) => {
            let harness = resolve_setup_harness(format, harness)?;
            run_setup(format, &harness)
        }
        Some(Commands::Update) => run_update(format),
        Some(Commands::Uninstall) => run_uninstall(format),
        Some(Commands::Marketplace { command }) => match command {
            MarketplaceCommands::Search { query } => run_marketplace_search(&query, format),
            MarketplaceCommands::Install { target, package } => {
                run_marketplace_install(&target, package.as_deref(), format)
            }
        },
        Some(Commands::Ralph(command)) => run_ralph(&command.args),
        Some(Commands::Context { command }) => match command {
            ContextCommands::Implement {
                context_file,
                max_iterations,
                timeout_seconds,
                rule_file,
                test_command,
                test_discovery_command,
            } => run_context_implement(
                &context_file,
                max_iterations,
                timeout_seconds,
                rule_file.as_deref(),
                test_command.as_deref(),
                test_discovery_command.as_deref(),
            ),
            ContextCommands::TestStatus {
                context_file,
                command_name,
            } => run_context_test_status(&context_file, command_name.as_deref()),
            ContextCommands::Backfill(backfill) => {
                run_context_backfill(backfill.context_file.as_deref(), backfill.all)
            }
        },
    };

    result
}
