//! Context management commands.
//!
//! Commands for listing, creating, updating, and deleting contexts.
//! These commands delegate to the Nexus server via nexus-client.

use anyhow::{Context, Result};
use nexus_client::NexusClient;
use serde::{Deserialize, Serialize};

use crate::cli::OutputFormat;
use crate::output::{print_error, print_info, print_success};

/// Context information returned from the server.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextInfo {
    pub id: String,
    pub project: String,
    pub title: String,
    pub status: String,
    pub file_path: String,
    pub created_at: String,
    pub updated_at: String,
    pub next_actions_count: usize,
}

/// Context detail with full content.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContextDetail {
    pub id: String,
    pub project: String,
    pub title: String,
    pub status: String,
    pub file_path: String,
    pub content: String,
    pub next_actions: Vec<NextAction>,
}

/// Next action from a context.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NextAction {
    pub test_name: String,
    pub description: String,
    pub outcome: String,
    pub status: ActionStatus,
}

/// Action status.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ActionStatus {
    Pending,
    InProgress,
    Done,
    Blocked,
}

impl std::fmt::Display for ActionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ActionStatus::Pending => write!(f, "pending"),
            ActionStatus::InProgress => write!(f, "in-progress"),
            ActionStatus::Done => write!(f, "done"),
            ActionStatus::Blocked => write!(f, "blocked"),
        }
    }
}

/// Connect to the Nexus server.
async fn connect_to_server() -> Result<std::sync::Arc<NexusClient>> {
    NexusClient::connect()
        .await
        .context("Failed to connect to Nexus server. Is it running? Try: nexus server start")
}

/// List contexts.
pub async fn run_context_list(project: Option<&str>, format: OutputFormat) -> Result<()> {
    let client = connect_to_server().await?;
    let contexts = client.context_list(project).await?;

    // Convert to our local type for consistent JSON output
    let infos: Vec<ContextInfo> = contexts
        .into_iter()
        .map(|c| ContextInfo {
            id: c.id,
            project: c.project,
            title: c.title,
            status: c.status,
            file_path: c.file_path,
            created_at: c.created_at.map(|t| t.to_rfc3339()).unwrap_or_default(),
            updated_at: c.updated_at.map(|t| t.to_rfc3339()).unwrap_or_default(),
            next_actions_count: c.next_actions_count,
        })
        .collect();

    if format == OutputFormat::Json {
        println!("{}", serde_json::to_string_pretty(&infos)?);
    } else {
        if infos.is_empty() {
            print_info("No contexts found");
            return Ok(());
        }

        println!("Contexts:");
        println!();
        for ctx in &infos {
            println!(
                "  {} [{}/{}] - {} ({} actions)",
                ctx.id, ctx.project, ctx.status, ctx.title, ctx.next_actions_count
            );
        }
        println!();
        println!("Use 'nexus context show <id>' for details");
    }

    Ok(())
}

/// Show context details.
pub async fn run_context_show(id: &str, format: OutputFormat) -> Result<()> {
    let client = connect_to_server().await?;

    let context = match client.context_get(id).await {
        Ok(ctx) => ctx,
        Err(nexus_client::ClientError::ServerError(msg)) if msg.contains("not found") => {
            print_error(&format!("Context not found: {}", id));
            print_info("Use 'nexus context list' to see available contexts");
            std::process::exit(1);
        }
        Err(e) => return Err(e.into()),
    };

    // Convert to our local type
    let detail = ContextDetail {
        id: context.id,
        project: context.project,
        title: context.title,
        status: context.status,
        file_path: context.file_path,
        content: context.content,
        next_actions: context
            .next_actions
            .into_iter()
            .map(|a| NextAction {
                test_name: a.test_name,
                description: a.description,
                outcome: a.outcome,
                status: match a.status {
                    nexus_client::ActionStatus::Pending => ActionStatus::Pending,
                    nexus_client::ActionStatus::InProgress => ActionStatus::InProgress,
                    nexus_client::ActionStatus::Done => ActionStatus::Done,
                    nexus_client::ActionStatus::Blocked => ActionStatus::Blocked,
                },
            })
            .collect(),
    };

    if format == OutputFormat::Json {
        println!("{}", serde_json::to_string_pretty(&detail)?);
    } else {
        println!("Context: {}", detail.id);
        println!("Project: {}", detail.project);
        println!("Title: {}", detail.title);
        println!("Status: {}", detail.status);
        println!("Path: {}", detail.file_path);
        println!();
        println!("Next Actions ({}):", detail.next_actions.len());
        for action in &detail.next_actions {
            println!(
                "  [{}] {} - {}",
                action.status, action.test_name, action.description
            );
        }
    }

    Ok(())
}

/// Create a new context.
pub async fn run_context_create(
    project: &str,
    title: Option<&str>,
    format: OutputFormat,
) -> Result<()> {
    if format != OutputFormat::Json {
        print_info(&format!("Creating context in project: {}", project));
        if let Some(t) = title {
            print_info(&format!("Title: {}", t));
        }
    }

    let client = connect_to_server().await?;
    let context = client.context_create(project, title).await?;

    if format == OutputFormat::Json {
        let info = ContextInfo {
            id: context.id.clone(),
            project: context.project,
            title: context.title,
            status: context.status,
            file_path: context.file_path,
            created_at: context
                .created_at
                .map(|t| t.to_rfc3339())
                .unwrap_or_default(),
            updated_at: context
                .updated_at
                .map(|t| t.to_rfc3339())
                .unwrap_or_default(),
            next_actions_count: context.next_actions_count,
        };
        println!("{}", serde_json::to_string_pretty(&info)?);
    } else {
        print_success(&format!("Created context: {}", context.id));
        print_info(&format!("Path: {}", context.file_path));
    }

    Ok(())
}

/// Update context metadata.
pub async fn run_context_update(
    id: &str,
    title: Option<&str>,
    status: Option<&str>,
    format: OutputFormat,
) -> Result<()> {
    if title.is_none() && status.is_none() {
        print_error("No updates specified. Use --title or --status");
        std::process::exit(1);
    }

    if format != OutputFormat::Json {
        print_info(&format!("Updating context: {}", id));
        if let Some(t) = title {
            print_info(&format!("New title: {}", t));
        }
        if let Some(s) = status {
            print_info(&format!("New status: {}", s));
        }
    }

    let client = connect_to_server().await?;
    let context = client.context_update(id, title, status).await?;

    if format == OutputFormat::Json {
        let info = ContextInfo {
            id: context.id.clone(),
            project: context.project,
            title: context.title,
            status: context.status,
            file_path: context.file_path,
            created_at: context
                .created_at
                .map(|t| t.to_rfc3339())
                .unwrap_or_default(),
            updated_at: context
                .updated_at
                .map(|t| t.to_rfc3339())
                .unwrap_or_default(),
            next_actions_count: context.next_actions_count,
        };
        println!("{}", serde_json::to_string_pretty(&info)?);
    } else {
        print_success(&format!("Updated context: {}", context.id));
    }

    Ok(())
}

/// Delete a context.
pub async fn run_context_delete(
    id: &str,
    force: bool,
    no_reorder: bool,
    format: OutputFormat,
) -> Result<()> {
    if !force && format != OutputFormat::Json {
        // Prompt for confirmation
        print_info(&format!("Would delete context: {}", id));
        print_info("Use --force to skip confirmation");

        // Use inquire for confirmation
        let confirm = inquire::Confirm::new(&format!("Delete context {}?", id))
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
        print_info(&format!("Deleting context: {}", id));
        if no_reorder {
            print_info("Skipping reorder (gaps will remain in numbering)");
        }
    }

    let client = connect_to_server().await?;
    client.context_delete(id, !no_reorder).await?;

    if format == OutputFormat::Json {
        println!(r#"{{"status": "deleted", "id": "{}"}}"#, id);
    } else {
        print_success(&format!("Deleted context: {}", id));
    }

    Ok(())
}

/// Move a context to a new position.
pub async fn run_context_move(id: &str, to: u32, format: OutputFormat) -> Result<()> {
    if format != OutputFormat::Json {
        print_info(&format!("Moving context {} to position {}", id, to));
    }

    let client = connect_to_server().await?;
    client.context_move(id, to).await?;

    if format == OutputFormat::Json {
        println!(
            r#"{{"status": "moved", "id": "{}", "position": {}}}"#,
            id, to
        );
    } else {
        print_success(&format!("Moved context {} to position {}", id, to));
    }

    Ok(())
}

/// Reorder contexts to remove gaps.
pub async fn run_context_reorder(project: &str, format: OutputFormat) -> Result<()> {
    if format != OutputFormat::Json {
        print_info(&format!("Reordering contexts in project: {}", project));
    }

    let client = connect_to_server().await?;
    let count = client.context_reorder(project).await?;

    if format == OutputFormat::Json {
        println!(
            r#"{{"status": "reordered", "project": "{}", "count": {}}}"#,
            project, count
        );
    } else {
        print_success(&format!(
            "Reordered {} contexts in project {}",
            count, project
        ));
    }

    Ok(())
}

/// Sync/validate E2E tests against context specification.
pub async fn run_context_sync(
    context: Option<&str>,
    project: Option<&str>,
    format: OutputFormat,
) -> Result<()> {
    if format != OutputFormat::Json {
        if let Some(ctx) = context {
            print_info(&format!("Syncing context: {}", ctx));
        } else if let Some(proj) = project {
            print_info(&format!("Syncing all contexts in project: {}", proj));
        } else {
            print_info("Syncing all contexts");
        }
    }

    let client = connect_to_server().await?;
    let results = client.context_sync(context, project).await?;

    if format == OutputFormat::Json {
        println!("{}", serde_json::to_string_pretty(&results)?);
    } else {
        let total_issues: usize = results.iter().map(|r| r.issues_found).sum();
        let total_synced: usize = results.iter().map(|r| r.tests_synced).sum();

        for result in &results {
            if result.success {
                print_success(&format!(
                    "{}: {} tests synced",
                    result.context_id, result.tests_synced
                ));
            } else {
                print_error(&format!(
                    "{}: {} issues found",
                    result.context_id, result.issues_found
                ));
                for issue in &result.issues {
                    println!("    - {}", issue);
                }
            }
        }

        println!();
        if total_issues == 0 {
            print_success(&format!(
                "Sync completed: {} tests synced, no issues",
                total_synced
            ));
        } else {
            print_info(&format!(
                "Sync completed: {} tests synced, {} issues found",
                total_synced, total_issues
            ));
        }
    }

    Ok(())
}
