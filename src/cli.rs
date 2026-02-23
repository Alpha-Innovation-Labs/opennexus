//! CLI argument parsing for the OpenNexus binary.

use clap::{Parser, Subcommand, ValueEnum};

#[derive(Debug, Parser)]
#[command(name = "opennexus")]
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
    Setup {
        /// Harness to configure in .nexus/config.json (default: opencode).
        #[arg(long, default_value = "opencode")]
        harness: String,
    },

    /// Update Nexus to the latest published version via cargo.
    Update,

    /// Uninstall Nexus via cargo.
    Uninstall,

    /// Search and install Nexus marketplace assets.
    Marketplace {
        #[command(subcommand)]
        command: MarketplaceCommands,
    },
}

#[derive(Debug, Clone, Subcommand)]
pub enum MarketplaceCommands {
    /// Search marketplace entries by query.
    Search {
        /// Query string matched against id, name, and description.
        query: String,
    },

    /// Install a marketplace entry or a GitHub source.
    Install {
        /// Marketplace id/name (e.g., fumadocs) or GitHub repo (owner/repo or github.com/owner/repo).
        target: String,

        /// Optional marketplace package name under .nexus/marketplace/<package> when target is a GitHub repo.
        package: Option<String>,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_marketplace_search_command() {
        let cli = Cli::parse_from(["opennexus", "marketplace", "search", "fumadocs"]);
        match cli.command {
            Some(Commands::Marketplace { command }) => match command {
                MarketplaceCommands::Search { query } => assert_eq!(query, "fumadocs"),
                _ => panic!("expected marketplace search command"),
            },
            _ => panic!("expected marketplace command"),
        }
    }

    #[test]
    fn parses_marketplace_install_command() {
        let cli = Cli::parse_from([
            "opennexus",
            "marketplace",
            "install",
            "github.com/owner/repo",
        ]);
        match cli.command {
            Some(Commands::Marketplace { command }) => match command {
                MarketplaceCommands::Install { target, package } => {
                    assert_eq!(target, "github.com/owner/repo");
                    assert!(package.is_none());
                }
                _ => panic!("expected marketplace install command"),
            },
            _ => panic!("expected marketplace command"),
        }
    }

    #[test]
    fn parses_marketplace_install_command_with_package() {
        let cli = Cli::parse_from([
            "opennexus",
            "marketplace",
            "install",
            "Alpha-Innovation-Labs/opennexus",
            "fumadocs",
        ]);
        match cli.command {
            Some(Commands::Marketplace { command }) => match command {
                MarketplaceCommands::Install { target, package } => {
                    assert_eq!(target, "Alpha-Innovation-Labs/opennexus");
                    assert_eq!(package.as_deref(), Some("fumadocs"));
                }
                _ => panic!("expected marketplace install command"),
            },
            _ => panic!("expected marketplace command"),
        }
    }

    #[test]
    fn parses_setup_with_harness() {
        let cli = Cli::parse_from(["opennexus", "setup", "--harness", "opencode"]);
        match cli.command {
            Some(Commands::Setup { harness }) => assert_eq!(harness, "opencode"),
            _ => panic!("expected setup command"),
        }
    }
}
