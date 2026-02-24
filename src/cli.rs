//! CLI argument parsing for the OpenNexus binary.

use clap::{ArgGroup, Args, Parser, Subcommand, ValueEnum};

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
        /// Harness to configure in .nexus/config.json.
        ///
        /// If omitted, setup opens an interactive fuzzy picker.
        #[arg(long)]
        harness: Option<String>,
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

    /// Run Ralph CLI with passthrough arguments.
    Ralph(RalphCommand),

    /// Context-driven development orchestration commands.
    Context {
        #[command(subcommand)]
        command: ContextCommands,
    },
}

#[derive(Debug, Clone, Args)]
#[command(disable_help_flag = true, disable_version_flag = true)]
pub struct RalphCommand {
    /// Arguments forwarded to the Ralph binary.
    #[arg(trailing_var_arg = true, allow_hyphen_values = true, num_args = 0..)]
    pub args: Vec<String>,
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

#[derive(Debug, Clone, Subcommand)]
pub enum ContextCommands {
    /// Run staged CDD orchestration for one context file.
    Implement {
        /// Path to a context file with frontmatter and Next Actions table.
        #[arg(long)]
        context_file: String,

        /// Maximum coder/validator iterations before stopping.
        #[arg(long, default_value_t = 3)]
        max_iterations: usize,

        /// Timeout bound in seconds for the full loop.
        #[arg(long, default_value_t = 600)]
        timeout_seconds: u64,

        /// Optional rule file under .nexus/ai_harness/rules/ to resolve ambiguity.
        #[arg(long)]
        rule_file: Option<String>,
    },

    /// Report discovered vs missing tests from a context file.
    TestStatus {
        /// Path to a context file with frontmatter and Next Actions table.
        #[arg(long)]
        context_file: String,

        /// Optional command id resolver (default: test-status; alias: status).
        #[arg(long)]
        command_name: Option<String>,
    },

    /// Reconcile context task status from existing tests and code.
    Backfill(ContextBackfillCommand),
}

#[derive(Debug, Clone, Args)]
#[command(group(
    ArgGroup::new("target")
        .required(true)
        .args(["context_file", "all"])
))]
pub struct ContextBackfillCommand {
    /// Path to one context file to backfill.
    #[arg(long)]
    pub context_file: Option<String>,

    /// Backfill every valid context spec under .nexus/context/.
    #[arg(long)]
    pub all: bool,
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
            Some(Commands::Setup { harness }) => assert_eq!(harness.as_deref(), Some("opencode")),
            _ => panic!("expected setup command"),
        }
    }

    #[test]
    fn parses_setup_without_harness() {
        let cli = Cli::parse_from(["opennexus", "setup"]);
        match cli.command {
            Some(Commands::Setup { harness }) => assert!(harness.is_none()),
            _ => panic!("expected setup command"),
        }
    }

    #[test]
    fn parses_ralph_passthrough_args() {
        let cli = Cli::parse_from([
            "opennexus",
            "ralph",
            "build login flow",
            "--max-iterations",
            "5",
            "--agent",
            "codex",
        ]);

        match cli.command {
            Some(Commands::Ralph(command)) => {
                assert_eq!(
                    command.args,
                    vec![
                        "build login flow",
                        "--max-iterations",
                        "5",
                        "--agent",
                        "codex",
                    ]
                );
            }
            _ => panic!("expected ralph command"),
        }
    }

    #[test]
    fn parses_context_implement_command() {
        let cli = Cli::parse_from([
            "opennexus",
            "context",
            "implement",
            "--context-file",
            ".nexus/context/nexus-cli/cdd/CDD_001-context-implement-rule-selection-gate.md",
            "--max-iterations",
            "5",
            "--timeout-seconds",
            "120",
            "--rule-file",
            "rust/SKILL.md",
        ]);
        match cli.command {
            Some(Commands::Context { command }) => match command {
                ContextCommands::Implement {
                    context_file,
                    max_iterations,
                    timeout_seconds,
                    rule_file,
                } => {
                    assert!(context_file.contains("CDD_001"));
                    assert_eq!(max_iterations, 5);
                    assert_eq!(timeout_seconds, 120);
                    assert_eq!(rule_file.as_deref(), Some("rust/SKILL.md"));
                }
                _ => panic!("expected context implement command"),
            },
            _ => panic!("expected context command"),
        }
    }

    #[test]
    fn parses_context_test_status_command() {
        let cli = Cli::parse_from([
            "opennexus",
            "context",
            "test-status",
            "--context-file",
            ".nexus/context/nexus-cli/cdd/CDD_002-context-test-status-command.md",
            "--command-name",
            "status",
        ]);
        match cli.command {
            Some(Commands::Context { command }) => match command {
                ContextCommands::TestStatus {
                    context_file,
                    command_name,
                } => {
                    assert!(context_file.contains("CDD_002"));
                    assert_eq!(command_name.as_deref(), Some("status"));
                }
                _ => panic!("expected context test-status command"),
            },
            _ => panic!("expected context command"),
        }
    }

    #[test]
    fn parses_context_backfill_context_file_command() {
        let cli = Cli::parse_from([
            "opennexus",
            "context",
            "backfill",
            "--context-file",
            ".nexus/context/nexus-cli/cdd/CDD_017-context-backfill-from-existing-code.md",
        ]);

        match cli.command {
            Some(Commands::Context { command }) => match command {
                ContextCommands::Backfill(backfill) => {
                    assert!(backfill
                        .context_file
                        .as_deref()
                        .unwrap_or_default()
                        .contains("CDD_017"));
                    assert!(!backfill.all);
                }
                _ => panic!("expected context backfill command"),
            },
            _ => panic!("expected context command"),
        }
    }

    #[test]
    fn parses_context_backfill_all_command() {
        let cli = Cli::parse_from(["opennexus", "context", "backfill", "--all"]);

        match cli.command {
            Some(Commands::Context { command }) => match command {
                ContextCommands::Backfill(backfill) => {
                    assert!(backfill.context_file.is_none());
                    assert!(backfill.all);
                }
                _ => panic!("expected context backfill command"),
            },
            _ => panic!("expected context command"),
        }
    }
}
