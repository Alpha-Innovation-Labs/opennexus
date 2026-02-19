//! Project management commands.
//!
//! Commands for listing, creating, and deleting projects.
//! These commands delegate to the Nexus server via nexus-client.

use anyhow::{Context, Result};
use nexus_client::NexusClient;
use serde::{Deserialize, Serialize};

use crate::cli::OutputFormat;
use crate::output::{print_error, print_info, print_success};

/// Project information returned from the server.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInfo {
    pub name: String,
    pub prefix: String,
    pub path: String,
    pub context_count: usize,
    pub created_at: String,
}

/// Connect to the Nexus server.
async fn connect_to_server() -> Result<std::sync::Arc<NexusClient>> {
    NexusClient::connect()
        .await
        .context("Failed to connect to Nexus server. Is it running? Try: nexus server start")
}

/// List all projects.
pub async fn run_project_list(format: OutputFormat) -> Result<()> {
    let client = connect_to_server().await?;
    let projects = client.project_list().await?;

    // Convert to our local type for consistent JSON output
    let infos: Vec<ProjectInfo> = projects
        .into_iter()
        .map(|p| ProjectInfo {
            name: p.name,
            prefix: p.prefix,
            path: p.path,
            context_count: p.context_count,
            created_at: p.created_at.map(|t| t.to_rfc3339()).unwrap_or_default(),
        })
        .collect();

    if format == OutputFormat::Json {
        println!("{}", serde_json::to_string_pretty(&infos)?);
    } else {
        if infos.is_empty() {
            print_info("No projects found");
            print_info("Create one with: nexus project create <name>");
            return Ok(());
        }

        println!("Projects:");
        println!();
        for proj in &infos {
            println!(
                "  {} ({}) - {} contexts",
                proj.name, proj.prefix, proj.context_count
            );
            println!("    Path: {}", proj.path);
        }
        println!();
        println!("Use 'nexus context list --project <name>' to see contexts");
    }

    Ok(())
}

/// Create a new project.
pub async fn run_project_create(
    name: &str,
    prefix: Option<&str>,
    format: OutputFormat,
) -> Result<()> {
    // Derive prefix if not provided (for display purposes)
    let display_prefix = prefix.map(|s| s.to_string()).unwrap_or_else(|| {
        name.chars()
            .filter(|c| c.is_alphabetic())
            .take(3)
            .collect::<String>()
            .to_uppercase()
    });

    if format != OutputFormat::Json {
        print_info(&format!(
            "Creating project: {} (prefix: {})",
            name, display_prefix
        ));
    }

    let client = connect_to_server().await?;
    let project = client.project_create(name, prefix).await?;

    if format == OutputFormat::Json {
        let info = ProjectInfo {
            name: project.name.clone(),
            prefix: project.prefix,
            path: project.path.clone(),
            context_count: project.context_count,
            created_at: project
                .created_at
                .map(|t| t.to_rfc3339())
                .unwrap_or_default(),
        };
        println!("{}", serde_json::to_string_pretty(&info)?);
    } else {
        print_success(&format!("Created project: {}", project.name));
        print_info(&format!("Path: {}", project.path));
        print_info(&format!("Prefix: {}", project.prefix));
    }

    Ok(())
}

/// Delete a project.
pub async fn run_project_delete(name: &str, force: bool, format: OutputFormat) -> Result<()> {
    // First, get project info to show context count
    let client = connect_to_server().await?;
    let projects = client.project_list().await?;

    let project = projects.iter().find(|p| p.name == name);
    let context_count = project.map(|p| p.context_count).unwrap_or(0);

    if project.is_none() {
        print_error(&format!("Project not found: {}", name));
        print_info("Use 'nexus project list' to see available projects");
        std::process::exit(1);
    }

    if !force && format != OutputFormat::Json {
        // Prompt for confirmation
        print_info(&format!(
            "This will delete project '{}' with {} contexts",
            name, context_count
        ));
        print_info("Use --force to skip confirmation");

        let confirm = inquire::Confirm::new(&format!("Delete project {}?", name))
            .with_default(false)
            .prompt();

        match confirm {
            Ok(true) => {}
            Ok(false) => {
                print_info("Cancelled");
                return Ok(());
            }
            Err(_) => {
                print_info("Cancelled");
                return Ok(());
            }
        }
    }

    if format != OutputFormat::Json {
        print_info(&format!("Deleting project: {}", name));
    }

    client.project_delete(name).await?;

    if format == OutputFormat::Json {
        println!(
            r#"{{"status": "deleted", "name": "{}", "contexts_deleted": {}}}"#,
            name, context_count
        );
    } else {
        print_success(&format!("Deleted project: {}", name));
    }

    Ok(())
}
