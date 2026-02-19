//! Workflow execution commands.
//!
//! Commands for listing, running, and managing workflow executions.
//! These commands delegate to the Nexus server via nexus-client.

use anyhow::{Context, Result};
use nexus_client::{NexusClient, WorkflowEventKind};
use serde::{Deserialize, Serialize};

use crate::cli::OutputFormat;
use crate::output::{print_error, print_info, print_success, StreamingOutput};

/// Workflow information returned from the server.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowInfo {
    pub name: String,
    pub description: String,
    pub parameters: Vec<WorkflowParameter>,
}

/// Workflow parameter definition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowParameter {
    pub name: String,
    pub description: String,
    pub required: bool,
    pub param_type: String,
    pub default: Option<String>,
}

/// Workflow execution status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStatus {
    pub id: String,
    pub name: String,
    pub status: ExecutionStatus,
    pub started_at: String,
    pub finished_at: Option<String>,
    pub output: Option<String>,
    pub error: Option<String>,
}

/// Execution status enum.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ExecutionStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

impl std::fmt::Display for ExecutionStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ExecutionStatus::Pending => write!(f, "pending"),
            ExecutionStatus::Running => write!(f, "running"),
            ExecutionStatus::Completed => write!(f, "completed"),
            ExecutionStatus::Failed => write!(f, "failed"),
            ExecutionStatus::Cancelled => write!(f, "cancelled"),
        }
    }
}

/// Connect to the Nexus server.
async fn connect_to_server() -> Result<std::sync::Arc<NexusClient>> {
    NexusClient::connect()
        .await
        .context("Failed to connect to Nexus server. Is it running? Try: nexus server start")
}

/// List available workflows.
pub async fn run_workflow_list(format: OutputFormat) -> Result<()> {
    let client = connect_to_server().await?;
    let workflows = client.list_workflows().await?;

    if format == OutputFormat::Json {
        // Convert to our local WorkflowInfo type for consistent output
        let infos: Vec<WorkflowInfo> = workflows
            .into_iter()
            .map(|w| WorkflowInfo {
                name: w.name,
                description: w.description,
                parameters: w
                    .parameters
                    .into_iter()
                    .map(|p| WorkflowParameter {
                        name: p.name,
                        description: p.description,
                        required: p.required,
                        param_type: "string".to_string(),
                        default: p.default,
                    })
                    .collect(),
            })
            .collect();
        println!("{}", serde_json::to_string_pretty(&infos)?);
    } else {
        println!("Available Workflows:");
        println!();
        for workflow in &workflows {
            println!("  {} - {}", workflow.name, workflow.description);
        }
        println!();
        println!("Use 'nexus workflow info <name>' for details");
    }

    Ok(())
}

/// Get workflow information.
pub async fn run_workflow_info(name: &str, format: OutputFormat) -> Result<()> {
    let client = connect_to_server().await?;

    let workflow = match client.get_workflow_info(name).await {
        Ok(info) => info,
        Err(nexus_client::ClientError::UnknownWorkflow(_)) => {
            print_error(&format!("Unknown workflow: {}", name));
            print_info("Use 'nexus workflow list' to see available workflows");
            std::process::exit(1);
        }
        Err(e) => return Err(e.into()),
    };

    if format == OutputFormat::Json {
        let info = WorkflowInfo {
            name: workflow.name,
            description: workflow.description,
            parameters: workflow
                .parameters
                .into_iter()
                .map(|p| WorkflowParameter {
                    name: p.name,
                    description: p.description,
                    required: p.required,
                    param_type: "string".to_string(),
                    default: p.default,
                })
                .collect(),
        };
        println!("{}", serde_json::to_string_pretty(&info)?);
    } else {
        println!("Workflow: {}", workflow.name);
        println!("Description: {}", workflow.description);
        println!();
        println!("Parameters:");
        for param in &workflow.parameters {
            let required = if param.required { " (required)" } else { "" };
            let default = param
                .default
                .as_ref()
                .map(|d| format!(" [default: {}]", d))
                .unwrap_or_default();
            println!("  --{} <string>{}{}", param.name, required, default);
            println!("      {}", param.description);
        }
    }

    Ok(())
}

/// Run a workflow.
pub async fn run_workflow_run(
    name: &str,
    params: Option<&str>,
    follow: bool,
    format: OutputFormat,
) -> Result<()> {
    // Parse parameters if provided
    let params_map: std::collections::HashMap<String, serde_json::Value> = if let Some(p) = params {
        serde_json::from_str(p).context("Invalid JSON parameters")?
    } else {
        std::collections::HashMap::new()
    };

    if format == OutputFormat::Json {
        println!(
            r#"{{"status": "starting", "workflow": "{}", "params": {}}}"#,
            name,
            serde_json::to_string(&params_map)?
        );
    } else {
        print_info(&format!("Starting workflow: {}", name));
        if !params_map.is_empty() {
            print_info(&format!("Parameters: {:?}", params_map));
        }
    }

    let client = connect_to_server().await?;

    // Build and start the workflow
    let mut builder = client.workflow(name);
    for (key, value) in params_map {
        builder = builder.json_param(&key, value);
    }

    let workflow_id = builder.start().await?;

    if format == OutputFormat::Json {
        println!(
            r#"{{"status": "started", "execution_id": "{}"}}"#,
            workflow_id
        );
    } else {
        print_success(&format!("Workflow started: {}", workflow_id));
    }

    if follow {
        // Stream output from the server
        if format != OutputFormat::Json {
            print_info("Following execution output...");
            println!();
        }

        let mut output = StreamingOutput::new();
        let mut events = client.subscribe(workflow_id).await?;

        while let Some(event) = events.next().await {
            match &event.kind {
                WorkflowEventKind::Output { content } => {
                    if format == OutputFormat::Json {
                        println!(
                            r#"{{"type": "output", "content": {}}}"#,
                            serde_json::to_string(content)?
                        );
                    } else {
                        print!("{}", content);
                    }
                }
                WorkflowEventKind::Progress(update) => {
                    if format == OutputFormat::Json {
                        println!(
                            r#"{{"type": "progress", "percent": {}, "message": {}}}"#,
                            update.percent,
                            serde_json::to_string(&update.message)?
                        );
                    } else {
                        output.write_progress(update.percent as usize, 100, &update.message);
                    }
                }
                WorkflowEventKind::Step(step) => {
                    if format == OutputFormat::Json {
                        println!(
                            r#"{{"type": "step", "name": {}, "step_id": {}}}"#,
                            serde_json::to_string(&step.name)?,
                            serde_json::to_string(&step.step_id)?
                        );
                    } else {
                        output.finish_inline();
                        output.write_line(&format!("[Step] {}", step.name));
                    }
                }
                WorkflowEventKind::Completed => {
                    output.finish_inline();
                    if format == OutputFormat::Json {
                        println!(r#"{{"type": "completed"}}"#);
                    } else {
                        println!();
                        print_success("Workflow completed");
                    }
                    break;
                }
                WorkflowEventKind::Failed { error } => {
                    output.finish_inline();
                    if format == OutputFormat::Json {
                        println!(
                            r#"{{"type": "failed", "error": {}}}"#,
                            serde_json::to_string(error)?
                        );
                    } else {
                        println!();
                        print_error(&format!("Workflow failed: {}", error));
                    }
                    std::process::exit(1);
                }
                WorkflowEventKind::Cancelled => {
                    output.finish_inline();
                    if format == OutputFormat::Json {
                        println!(r#"{{"type": "cancelled"}}"#);
                    } else {
                        println!();
                        print_info("Workflow cancelled");
                    }
                    break;
                }
                _ => {}
            }
        }
    } else {
        print_info(&format!(
            "Use 'nexus workflow status {}' to check progress",
            workflow_id
        ));
    }

    Ok(())
}

/// Check workflow execution status.
pub async fn run_workflow_status(id: &str, format: OutputFormat) -> Result<()> {
    let client = connect_to_server().await?;

    let workflow_id = uuid::Uuid::parse_str(id).context("Invalid workflow ID format")?;
    let status = client.get_workflow(workflow_id).await?;

    let execution_status = match status.state {
        nexus_client::WorkflowState::Pending => ExecutionStatus::Pending,
        nexus_client::WorkflowState::Running => ExecutionStatus::Running,
        nexus_client::WorkflowState::Completed => ExecutionStatus::Completed,
        nexus_client::WorkflowState::Failed => ExecutionStatus::Failed,
        nexus_client::WorkflowState::Cancelled => ExecutionStatus::Cancelled,
    };

    let workflow_status = WorkflowStatus {
        id: status.id.to_string(),
        name: status.name,
        status: execution_status,
        started_at: status.started_at.to_rfc3339(),
        finished_at: status.completed_at.map(|t| t.to_rfc3339()),
        output: status.current_step,
        error: status.error,
    };

    if format == OutputFormat::Json {
        println!("{}", serde_json::to_string_pretty(&workflow_status)?);
    } else {
        println!("Execution ID: {}", workflow_status.id);
        println!("Workflow: {}", workflow_status.name);
        println!("Status: {}", workflow_status.status);
        println!("Started: {}", workflow_status.started_at);
        if let Some(finished) = &workflow_status.finished_at {
            println!("Finished: {}", finished);
        }
        if let Some(output) = &workflow_status.output {
            println!();
            println!("Current Step: {}", output);
        }
        if let Some(error) = &workflow_status.error {
            println!();
            println!("Error:");
            println!("{}", error);
        }
    }

    Ok(())
}

/// Cancel a running workflow.
pub async fn run_workflow_cancel(id: &str, format: OutputFormat) -> Result<()> {
    let client = connect_to_server().await?;

    let workflow_id = uuid::Uuid::parse_str(id).context("Invalid workflow ID format")?;
    client.cancel_workflow(workflow_id).await?;

    if format == OutputFormat::Json {
        println!(r#"{{"status": "cancelled", "execution_id": "{}"}}"#, id);
    } else {
        print_success(&format!("Cancelled execution: {}", id));
    }

    Ok(())
}

/// Run gen-tests workflow (top-level command).
pub async fn run_gen_tests(
    context: Option<&str>,
    action: Option<&str>,
    max_retries: u32,
    all: bool,
    skip_retries: bool,
    debug: bool,
    parallel: bool,
    format: OutputFormat,
) -> Result<()> {
    // Build parameters
    let mut params = std::collections::HashMap::new();
    if let Some(c) = context {
        params.insert("context".to_string(), serde_json::json!(c));
    }
    if let Some(a) = action {
        params.insert("action".to_string(), serde_json::json!(a));
    }
    params.insert("max_retries".to_string(), serde_json::json!(max_retries));
    params.insert("all".to_string(), serde_json::json!(all));
    params.insert("skip_retries".to_string(), serde_json::json!(skip_retries));
    params.insert("debug".to_string(), serde_json::json!(debug));
    params.insert("parallel".to_string(), serde_json::json!(parallel));

    if format == OutputFormat::Json {
        println!(
            r#"{{"workflow": "gen-tests", "params": {}}}"#,
            serde_json::to_string(&params)?
        );
    } else {
        print_info("Starting gen-tests workflow...");
        if debug {
            print_info(&format!("Parameters: {:?}", params));
        }
    }

    let client = connect_to_server().await?;

    // Start the workflow
    let mut builder = client.workflow("gen-tests");
    for (key, value) in params {
        builder = builder.json_param(&key, value);
    }

    let workflow_id = builder.start().await?;

    if format != OutputFormat::Json {
        print_success(&format!("Workflow started: {}", workflow_id));
    }

    // Stream events
    let mut output = StreamingOutput::new();
    let mut events = client.subscribe(workflow_id).await?;

    while let Some(event) = events.next().await {
        match &event.kind {
            WorkflowEventKind::Output { content } => {
                if format == OutputFormat::Json {
                    println!(
                        r#"{{"type": "output", "content": {}}}"#,
                        serde_json::to_string(content)?
                    );
                } else {
                    print!("{}", content);
                }
            }
            WorkflowEventKind::Progress(update) => {
                if format != OutputFormat::Json {
                    output.write_progress(update.percent as usize, 100, &update.message);
                }
            }
            WorkflowEventKind::Agent(agent) => {
                if let nexus_client::AgentEventKind::TextDelta { delta } = &agent.kind {
                    if format == OutputFormat::Json {
                        println!(
                            r#"{{"type": "agent_output", "agent": {}, "delta": {}}}"#,
                            serde_json::to_string(&agent.name)?,
                            serde_json::to_string(delta)?
                        );
                    } else {
                        print!("{}", delta);
                    }
                }
            }
            WorkflowEventKind::Tool(tool) => {
                if format != OutputFormat::Json {
                    output.finish_inline();
                    if let nexus_client::ToolEventKind::Started { .. } = &tool.kind {
                        output.write_line(&format!("[Tool] {}", tool.name));
                    }
                }
            }
            WorkflowEventKind::Completed => {
                output.finish_inline();
                if format == OutputFormat::Json {
                    println!(r#"{{"type": "completed"}}"#);
                } else {
                    println!();
                    print_success("gen-tests workflow completed");
                }
                break;
            }
            WorkflowEventKind::Failed { error } => {
                output.finish_inline();
                if format == OutputFormat::Json {
                    println!(
                        r#"{{"type": "failed", "error": {}}}"#,
                        serde_json::to_string(error)?
                    );
                } else {
                    println!();
                    print_error(&format!("gen-tests workflow failed: {}", error));
                }
                std::process::exit(1);
            }
            _ => {}
        }
    }

    Ok(())
}

/// Run gen-code workflow (top-level command).
pub async fn run_gen_code(
    context: Option<&str>,
    action: Option<&str>,
    max_retries: u32,
    skip_retries: bool,
    debug: bool,
    undo: bool,
    id: Option<&str>,
    no_worktree: bool,
    auto_merge: bool,
    test_cmd: Option<&str>,
    format: OutputFormat,
) -> Result<()> {
    // Build parameters
    let mut params = std::collections::HashMap::new();
    if let Some(c) = context {
        params.insert("context".to_string(), serde_json::json!(c));
    }
    if let Some(a) = action {
        params.insert("action".to_string(), serde_json::json!(a));
    }
    params.insert("max_retries".to_string(), serde_json::json!(max_retries));
    params.insert("skip_retries".to_string(), serde_json::json!(skip_retries));
    params.insert("debug".to_string(), serde_json::json!(debug));
    params.insert("undo".to_string(), serde_json::json!(undo));
    if let Some(i) = id {
        params.insert("id".to_string(), serde_json::json!(i));
    }
    params.insert("no_worktree".to_string(), serde_json::json!(no_worktree));
    params.insert("auto_merge".to_string(), serde_json::json!(auto_merge));
    if let Some(cmd) = test_cmd {
        params.insert("test_cmd".to_string(), serde_json::json!(cmd));
    }

    if format == OutputFormat::Json {
        println!(
            r#"{{"workflow": "gen-code", "params": {}}}"#,
            serde_json::to_string(&params)?
        );
    } else {
        print_info("Starting gen-code workflow...");
        if debug {
            print_info(&format!("Parameters: {:?}", params));
        }
    }

    let client = connect_to_server().await?;

    // Start the workflow
    let mut builder = client.workflow("gen-code");
    for (key, value) in params {
        builder = builder.json_param(&key, value);
    }

    let workflow_id = builder.start().await?;

    if format != OutputFormat::Json {
        print_success(&format!("Workflow started: {}", workflow_id));
    }

    // Stream events
    let mut output = StreamingOutput::new();
    let mut events = client.subscribe(workflow_id).await?;

    while let Some(event) = events.next().await {
        match &event.kind {
            WorkflowEventKind::Output { content } => {
                if format == OutputFormat::Json {
                    println!(
                        r#"{{"type": "output", "content": {}}}"#,
                        serde_json::to_string(content)?
                    );
                } else {
                    print!("{}", content);
                }
            }
            WorkflowEventKind::Progress(update) => {
                if format != OutputFormat::Json {
                    output.write_progress(update.percent as usize, 100, &update.message);
                }
            }
            WorkflowEventKind::Agent(agent) => {
                if let nexus_client::AgentEventKind::TextDelta { delta } = &agent.kind {
                    if format == OutputFormat::Json {
                        println!(
                            r#"{{"type": "agent_output", "agent": {}, "delta": {}}}"#,
                            serde_json::to_string(&agent.name)?,
                            serde_json::to_string(delta)?
                        );
                    } else {
                        print!("{}", delta);
                    }
                }
            }
            WorkflowEventKind::Tool(tool) => {
                if format != OutputFormat::Json {
                    output.finish_inline();
                    if let nexus_client::ToolEventKind::Started { .. } = &tool.kind {
                        output.write_line(&format!("[Tool] {}", tool.name));
                    }
                }
            }
            WorkflowEventKind::Completed => {
                output.finish_inline();
                if format == OutputFormat::Json {
                    println!(r#"{{"type": "completed"}}"#);
                } else {
                    println!();
                    print_success("gen-code workflow completed");
                }
                break;
            }
            WorkflowEventKind::Failed { error } => {
                output.finish_inline();
                if format == OutputFormat::Json {
                    println!(
                        r#"{{"type": "failed", "error": {}}}"#,
                        serde_json::to_string(error)?
                    );
                } else {
                    println!();
                    print_error(&format!("gen-code workflow failed: {}", error));
                }
                std::process::exit(1);
            }
            _ => {}
        }
    }

    Ok(())
}

/// Run context management workflow (top-level command).
pub async fn run_manage(project: Option<&str>, format: OutputFormat) -> Result<()> {
    let mut params = std::collections::HashMap::new();
    if let Some(p) = project {
        params.insert("project".to_string(), serde_json::json!(p));
    }

    if format == OutputFormat::Json {
        println!(
            r#"{{"workflow": "manage-context", "params": {}}}"#,
            serde_json::to_string(&params)?
        );
    } else {
        print_info("Starting context management workflow...");
    }

    let client = connect_to_server().await?;

    // Start the workflow
    let mut builder = client.workflow("manage-context");
    for (key, value) in params {
        builder = builder.json_param(&key, value);
    }

    let workflow_id = builder.start().await?;

    if format != OutputFormat::Json {
        print_success(&format!("Workflow started: {}", workflow_id));
    }

    // Stream events (manage-context is interactive, so mainly just stream output)
    let mut events = client.subscribe(workflow_id).await?;

    while let Some(event) = events.next().await {
        match &event.kind {
            WorkflowEventKind::Output { content } => {
                print!("{}", content);
            }
            WorkflowEventKind::Completed => {
                if format == OutputFormat::Json {
                    println!(r#"{{"type": "completed"}}"#);
                } else {
                    print_success("Context management completed");
                }
                break;
            }
            WorkflowEventKind::Failed { error } => {
                if format == OutputFormat::Json {
                    println!(
                        r#"{{"type": "failed", "error": {}}}"#,
                        serde_json::to_string(error)?
                    );
                } else {
                    print_error(&format!("Context management failed: {}", error));
                }
                std::process::exit(1);
            }
            _ => {}
        }
    }

    Ok(())
}
