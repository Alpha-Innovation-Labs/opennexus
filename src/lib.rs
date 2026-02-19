//! Setup-only Nexus CLI library exports.

pub mod cli;
pub mod commands;
pub mod output;

pub use cli::{Cli, Commands, OutputFormat};
pub use commands::run_setup;
