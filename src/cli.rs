//! CLI argument parsing for the OpenNexus binary.

use clap::{Args, Parser, Subcommand, ValueEnum};

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

    /// Run an orchestration pipeline by name.
    Orchestration(OrchestrationCommand),
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

#[derive(Debug, Clone, Args)]
pub struct OrchestrationCommand {
    /// Name of the orchestration pipeline from the pipeline file.
    pub pipeline_name: String,

    /// Optional secondary pipeline name (used by restart command mode).
    pub target_pipeline_name: Option<String>,

    /// Path to a specification file with frontmatter and Next Actions table.
    #[arg(long)]
    pub context_file: Option<String>,

    /// Pipeline definition file (JSON/YAML). Defaults to local orchestration search paths.
    #[arg(long)]
    pub pipeline_file: Option<String>,

    /// Maximum coder/validator iterations before stopping.
    #[arg(long, default_value_t = 3)]
    pub max_iterations: usize,

    /// Timeout bound in seconds for the full loop.
    #[arg(long, default_value_t = 600)]
    pub timeout_seconds: u64,

    /// Optional rule file under .nexus/ai_harness/rules/ to resolve ambiguity.
    #[arg(long)]
    pub rule_file: Option<String>,

    /// Optional explicit test command template. Use {test_id} placeholder.
    #[arg(long)]
    pub test_command: Option<String>,

    /// Optional explicit test discovery command used before coding starts.
    #[arg(long)]
    pub test_discovery_command: Option<String>,

    /// Optional OpenCode model id for orchestration LLM stages.
    #[arg(long)]
    pub model: Option<String>,

    /// Optional checkpoint file path to persist step state after each step.
    #[arg(long)]
    pub checkpoint_file: Option<String>,

    /// Resume from a saved checkpoint file.
    #[arg(long)]
    pub resume_checkpoint: Option<String>,

    /// Bypass context dependency blocking gates.
    #[arg(long, default_value_t = false)]
    pub allow_dependency_bypass: bool,

    /// Force a new run even when dedupe fingerprint matches a successful run.
    #[arg(long, default_value_t = false)]
    pub overwrite: bool,

    /// Run id for `orchestration traces` query mode.
    #[arg(long)]
    pub run_id: Option<i64>,

    /// Filter timelines/runs by context id.
    #[arg(long)]
    pub context_id: Option<String>,

    /// Filter timelines by pipeline name.
    #[arg(long)]
    pub pipeline_filter: Option<String>,
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
    fn parses_orchestration_command() {
        let cli = Cli::parse_from([
            "opennexus",
            "orchestration",
            "default",
            "--context-file",
            ".nexus/context/nexus-cli/cdd/CDD_001-context-implement-rule-selection-gate.md",
            "--max-iterations",
            "5",
            "--timeout-seconds",
            "120",
            "--rule-file",
            "rust/SKILL.md",
            "--model",
            "openai/gpt-5.3-codex",
        ]);
        match cli.command {
            Some(Commands::Orchestration(command)) => {
                assert_eq!(command.pipeline_name, "default");
                assert!(command.target_pipeline_name.is_none());
                assert!(command
                    .context_file
                    .as_deref()
                    .unwrap_or_default()
                    .contains("CDD_001"));
                assert_eq!(command.max_iterations, 5);
                assert_eq!(command.timeout_seconds, 120);
                assert_eq!(command.rule_file.as_deref(), Some("rust/SKILL.md"));
                assert_eq!(command.model.as_deref(), Some("openai/gpt-5.3-codex"));
                assert!(command.test_command.is_none());
                assert!(command.test_discovery_command.is_none());
                assert!(command.checkpoint_file.is_none());
                assert!(command.resume_checkpoint.is_none());
                assert!(!command.allow_dependency_bypass);
                assert!(!command.overwrite);
                assert!(command.run_id.is_none());
                assert!(command.context_id.is_none());
                assert!(command.pipeline_filter.is_none());
            }
            _ => panic!("expected orchestration command"),
        }
    }

    #[test]
    fn parses_orchestration_stop_command() {
        let cli = Cli::parse_from([
            "opennexus",
            "orchestration",
            "stop",
            "--context-file",
            ".nexus/context/demo/CTX_001.md",
            "--pipeline-filter",
            "default",
        ]);
        match cli.command {
            Some(Commands::Orchestration(command)) => {
                assert_eq!(command.pipeline_name, "stop");
                assert!(command.target_pipeline_name.is_none());
                assert_eq!(
                    command.context_file.as_deref(),
                    Some(".nexus/context/demo/CTX_001.md")
                );
                assert_eq!(command.pipeline_filter.as_deref(), Some("default"));
                assert!(command.model.is_none());
            }
            _ => panic!("expected orchestration stop command"),
        }
    }

    #[test]
    fn parses_orchestration_restart_command() {
        let cli = Cli::parse_from([
            "opennexus",
            "orchestration",
            "restart",
            "default",
            "--context-file",
            ".nexus/context/demo/CTX_001.md",
        ]);
        match cli.command {
            Some(Commands::Orchestration(command)) => {
                assert_eq!(command.pipeline_name, "restart");
                assert_eq!(command.target_pipeline_name.as_deref(), Some("default"));
                assert_eq!(
                    command.context_file.as_deref(),
                    Some(".nexus/context/demo/CTX_001.md")
                );
                assert!(command.model.is_none());
            }
            _ => panic!("expected orchestration restart command"),
        }
    }
}
