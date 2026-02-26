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

use cli::{Cli, Commands, MarketplaceCommands};
use commands::{
    resolve_setup_harness, run_marketplace_install, run_marketplace_search,
    run_orchestration_pipeline, run_ralph, run_setup, run_uninstall, run_update,
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
        Some(Commands::Orchestration(command)) => run_orchestration_pipeline(
            format,
            &command.pipeline_name,
            command.target_pipeline_name.as_deref(),
            command.pipeline_file.as_deref(),
            command.context_file.as_deref(),
            command.max_iterations,
            command.timeout_seconds,
            command.rule_file.as_deref(),
            command.test_command.as_deref(),
            command.test_discovery_command.as_deref(),
            command.model.as_deref(),
            command.checkpoint_file.as_deref(),
            command.resume_checkpoint.as_deref(),
            command.allow_dependency_bypass,
            command.overwrite,
            command.run_id,
            command.context_id.as_deref(),
            command.pipeline_filter.as_deref(),
        ),
    };

    result
}
