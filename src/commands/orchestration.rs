use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::PathBuf;
use std::process::Command;

use crate::adapters::orchestration_store::{
    default_orchestration_database_path, OrchestrationStore, TimelineFilter, TimelineRow,
    TraceQueryRow,
};
use crate::app::run_orchestration_implement_app;
use crate::cli::OutputFormat;
use crate::core::context::model::ContextImplementOptions;
use crate::features::context::parser::parse_context_file;

#[derive(Debug, Deserialize)]
struct PipelineCatalog {
    pipelines: BTreeMap<String, PipelineDefinition>,
}

#[derive(Debug, Deserialize)]
struct PipelineDefinition {
    steps: Vec<String>,
    red_failure_patterns: Vec<String>,
}

pub fn run_orchestration_pipeline(
    format: OutputFormat,
    pipeline_name: &str,
    target_pipeline_name: Option<&str>,
    pipeline_file: Option<&str>,
    context_file: Option<&str>,
    max_iterations: usize,
    timeout_seconds: u64,
    rule_file: Option<&str>,
    test_command: Option<&str>,
    test_discovery_command: Option<&str>,
    model: Option<&str>,
    checkpoint_file: Option<&str>,
    resume_checkpoint: Option<&str>,
    allow_dependency_bypass: bool,
    overwrite: bool,
    run_id: Option<i64>,
    context_id_filter: Option<&str>,
    pipeline_filter: Option<&str>,
) -> Result<()> {
    if !matches!(pipeline_name, "timeline") {
        context_file.context("`orchestration <pipeline>` requires --context-file <path>")?;
    }
    if pipeline_name == "status" {
        return orchestration_status(context_file.expect("context file checked above"), format);
    }
    if pipeline_name == "active" {
        return orchestration_active(
            context_file.expect("context file checked above"),
            pipeline_filter,
            format,
        );
    }
    if pipeline_name == "runs" {
        return orchestration_runs(context_file.expect("context file checked above"), format);
    }
    if pipeline_name == "stop" {
        return orchestration_stop(
            context_file.expect("context file checked above"),
            pipeline_filter,
            format,
        );
    }
    if pipeline_name == "restart" {
        let next_pipeline = target_pipeline_name
            .context("`orchestration restart <pipeline_name>` requires a target pipeline name.")?;
        return orchestration_restart(
            format,
            next_pipeline,
            pipeline_file,
            context_file.expect("context file checked above"),
            max_iterations,
            timeout_seconds,
            rule_file,
            test_command,
            test_discovery_command,
            model,
            checkpoint_file,
            allow_dependency_bypass,
            run_id,
            context_id_filter,
            pipeline_filter,
        );
    }
    if pipeline_name == "traces" {
        let run_id = run_id.context("`orchestration traces` requires --run-id <id>")?;
        return orchestration_traces(
            context_file.expect("context file checked above"),
            run_id,
            format,
        );
    }
    if pipeline_name == "artifacts" {
        let run_id = run_id.context("`orchestration artifacts` requires --run-id <id>")?;
        return orchestration_artifacts(
            context_file.expect("context file checked above"),
            run_id,
            format,
        );
    }
    if pipeline_name == "timeline" {
        return orchestration_timeline(
            TimelineFilter {
                run_id,
                context_id: context_id_filter.map(str::to_string),
                context_file: context_file.map(str::to_string),
                pipeline_name: pipeline_filter.map(str::to_string),
            },
            format,
        );
    }

    let context_file = context_file.expect("context file checked above");

    if target_pipeline_name.is_some() {
        bail!(
            "Unexpected extra positional argument '{}'. Only `orchestration restart <pipeline_name>` accepts a second positional pipeline name.",
            target_pipeline_name.unwrap_or_default()
        );
    }

    let (pipeline_path, catalog) = resolve_pipeline_catalog(pipeline_file)?;
    let pipeline = catalog.pipelines.get(pipeline_name).ok_or_else(|| {
        anyhow::anyhow!(
            "Pipeline '{}' not found in '{}'. Available: {}",
            pipeline_name,
            pipeline_path.display(),
            catalog
                .pipelines
                .keys()
                .cloned()
                .collect::<Vec<String>>()
                .join(", ")
        )
    })?;

    let mut options = ContextImplementOptions {
        pipeline_name: pipeline_name.to_string(),
        context_file: PathBuf::from(context_file),
        max_iterations,
        timeout_seconds,
        rule_file: rule_file.map(str::to_string),
        test_command: test_command.map(str::to_string),
        test_discovery_command: test_discovery_command.map(str::to_string),
        agent_model: None,
        pipeline_steps: Some(pipeline.steps.clone()),
        red_failure_patterns: pipeline
            .red_failure_patterns
            .iter()
            .map(|s| s.to_ascii_lowercase())
            .collect(),
        checkpoint_file: checkpoint_file.map(PathBuf::from),
        resume_checkpoint: resume_checkpoint.map(PathBuf::from),
        allow_dependency_bypass,
        overwrite,
        run_id: None,
    };

    if options.red_failure_patterns.is_empty() {
        bail!(
            "Pipeline '{}' must define at least one red_failure_patterns entry in '{}'.",
            pipeline_name,
            pipeline_path.display()
        );
    }

    let selected_model = resolve_opencode_model(model)?;
    if let Some(model_id) = &selected_model {
        println!("Orchestration model: {}", model_id);
    } else {
        println!("Orchestration model: opencode/default");
    }
    options.agent_model = selected_model;

    let parsed = parse_context_file(&PathBuf::from(context_file))?;
    println!(
        "Orchestration startup: context_id={}, pipeline={}, steps={}",
        parsed.context_id,
        pipeline_name,
        pipeline.steps.len()
    );

    let store = OrchestrationStore::open(&default_orchestration_database_path())?;
    let context_snapshot = fs::read_to_string(context_file)
        .with_context(|| format!("Unable to read context file '{}'.", context_file))?;
    let context_snapshot_hash = compute_sha256(&context_snapshot);
    if let Some(previous_hash) = store.latest_success_snapshot_hash(&parsed.context_id)? {
        if previous_hash != context_snapshot_hash {
            println!(
                "Context drift detected for context_id={}: previous_hash={} current_hash={}. Marking prior successful runs as stale.",
                parsed.context_id, previous_hash, context_snapshot_hash
            );
            store.mark_context_runs_stale(&parsed.context_id, &context_snapshot_hash)?;
        }
    }
    let fingerprint = compute_run_fingerprint(
        pipeline_name,
        &pipeline.steps,
        &context_snapshot,
        rule_file,
        test_command,
        test_discovery_command,
        options.agent_model.as_deref(),
    );
    let prior_equivalent = store.find_successful_run_by_fingerprint(&fingerprint)?;
    if !overwrite {
        if let Some(existing) = prior_equivalent {
            emit_json_or_text(
                format,
                &ActionResultPayload {
                    action: "start".to_string(),
                    context_file: context_file.to_string(),
                    pipeline_name: Some(pipeline_name.to_string()),
                    run_id: Some(existing.0),
                    status: "success".to_string(),
                    terminal_reason: Some("dedup_skipped".to_string()),
                    started_at: None,
                    ended_at: Some(existing.1),
                    message: "Equivalent successful run already exists; skipped execution."
                        .to_string(),
                    remediation: Some("Use --overwrite to force a new run.".to_string()),
                    active_run_ids: vec![],
                },
            )?;
            return Ok(());
        }
    }

    let (run_id, action_summary) = store.create_run_with_snapshot_and_actions(
        pipeline_name,
        &parsed.context_id,
        context_file,
        &fingerprint,
        overwrite,
        if overwrite {
            prior_equivalent.map(|entry| entry.0)
        } else {
            None
        },
        Some(std::process::id() as i64),
        &context_snapshot_hash,
        &context_snapshot,
        &parsed.next_actions,
    )?;
    options.run_id = Some(run_id);
    println!(
        "Next-action reconciliation: added_pending={} removed_cancelled={} retained_active={}",
        action_summary.added_pending,
        action_summary.removed_cancelled,
        action_summary.retained_active
    );

    run_orchestration_implement_app(&options).or_else(|err| {
        let _ = store.finish_run(run_id, "failed", Some(&err.to_string()));
        Err(err)
    })?;
    store.finish_run(run_id, "success", None)?;

    let latest = store.latest_run_for_context(context_file)?;
    let (status, terminal_reason, ended_at) = if let Some(run) = latest {
        (run.2, run.3, run.4)
    } else {
        ("success".to_string(), None, None)
    };
    emit_json_or_text(
        format,
        &ActionResultPayload {
            action: "start".to_string(),
            context_file: context_file.to_string(),
            pipeline_name: Some(pipeline_name.to_string()),
            run_id: Some(run_id),
            status,
            terminal_reason,
            started_at: None,
            ended_at,
            message: "Pipeline execution completed.".to_string(),
            remediation: None,
            active_run_ids: vec![],
        },
    )?;
    Ok(())
}

fn orchestration_timeline(filter: TimelineFilter, format: OutputFormat) -> Result<()> {
    if filter.run_id.is_none()
        && filter.context_id.is_none()
        && filter.context_file.is_none()
        && filter.pipeline_name.is_none()
    {
        bail!(
            "`orchestration timeline` requires at least one filter: --run-id, --context-id, --context-file, or --pipeline-filter."
        );
    }

    let store = OrchestrationStore::open(&default_orchestration_database_path())?;
    if let Some(run_id) = filter.run_id {
        if !store.run_exists(run_id)? {
            bail!(
                "Unknown run id '{}'. Use `opennexus orchestration runs --context-file <path>` to list valid run ids.",
                run_id
            );
        }
    }

    let rows = store.query_timeline(&filter)?;
    if rows.is_empty() {
        println!("No timeline rows found for supplied filters.");
        return Ok(());
    }

    if format == OutputFormat::Json {
        let payload = rows
            .iter()
            .map(TimelineJsonRow::from)
            .collect::<Vec<TimelineJsonRow>>();
        println!("{}", serde_json::to_string_pretty(&payload)?);
        return Ok(());
    }

    for row in rows {
        println!(
            "run_id={} context_id={} pipeline={} run_status={} step_attempt_id={} step={} attempt={} status={} terminal={} started={} finished={} traces={:?} artifacts={:?}",
            row.run_id,
            row.context_id,
            row.pipeline_name,
            row.run_status,
            row.step_attempt_id,
            row.step_id,
            row.attempt_index,
            row.step_status,
            row.terminal_reason.unwrap_or_else(|| "n/a".to_string()),
            row.started_at,
            row.finished_at,
            row.trace_ids,
            row.artifact_refs
        );
    }
    Ok(())
}

fn compute_sha256(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn resolve_opencode_model(requested: Option<&str>) -> Result<Option<String>> {
    let Some(requested_model) = requested.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };

    let available = list_opencode_models().with_context(|| {
        "Unable to validate requested model. Run `opencode models` to inspect available model ids."
    })?;
    if available.contains(requested_model) {
        return Ok(Some(requested_model.to_string()));
    }

    let preview = available
        .iter()
        .take(12)
        .cloned()
        .collect::<Vec<String>>()
        .join(", ");
    bail!(
        "Requested model '{}' was not found in `opencode models`. Sample available models: {}",
        requested_model,
        preview
    )
}

fn list_opencode_models() -> Result<BTreeSet<String>> {
    let output = Command::new("opencode")
        .arg("models")
        .output()
        .context("Failed to execute `opencode models`.")?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        bail!("`opencode models` failed: {}", stderr.trim());
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let models = stdout
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(str::to_string)
        .collect::<BTreeSet<String>>();

    if models.is_empty() {
        bail!("`opencode models` returned no model ids.");
    }
    Ok(models)
}

fn load_pipeline_catalog(path: &PathBuf) -> Result<PipelineCatalog> {
    if !path.exists() {
        bail!(
            "Pipeline definition file '{}' does not exist.",
            path.display()
        );
    }
    let content = fs::read_to_string(path).with_context(|| {
        format!(
            "Unable to read pipeline definition file '{}'.",
            path.display()
        )
    })?;
    let catalog: PipelineCatalog = if path
        .extension()
        .and_then(|x| x.to_str())
        .map(|x| matches!(x, "yaml" | "yml"))
        .unwrap_or(false)
    {
        serde_yaml::from_str(&content).with_context(|| {
            format!(
                "Invalid YAML in pipeline file '{}'. Ensure top-level object has `pipelines` map and each pipeline defines `steps` and `red_failure_patterns`.",
                path.display()
            )
        })?
    } else {
        serde_json::from_str(&content).with_context(|| {
            format!(
                "Invalid JSON in pipeline file '{}'. Ensure top-level object has `pipelines` map and each pipeline defines `steps` and `red_failure_patterns`.",
                path.display()
            )
        })?
    };
    Ok(catalog)
}

fn resolve_pipeline_catalog(explicit: Option<&str>) -> Result<(PathBuf, PipelineCatalog)> {
    if let Some(path) = explicit {
        let path = PathBuf::from(path);
        let catalog = load_pipeline_catalog(&path)?;
        return Ok((path, catalog));
    }

    let candidates = [
        ".nexus/orchestration/pipelines.json",
        ".nexus/orchestration/pipelines.yaml",
        ".nexus/orchestration/pipelines.yml",
    ];
    for candidate in candidates {
        let path = PathBuf::from(candidate);
        if path.exists() {
            let catalog = load_pipeline_catalog(&path)?;
            return Ok((path, catalog));
        }
    }
    bail!(
        "No pipeline definition file found. Looked for: {}",
        candidates.join(", ")
    )
}

fn compute_run_fingerprint(
    pipeline_name: &str,
    steps: &[String],
    context_snapshot: &str,
    rule_file: Option<&str>,
    test_command: Option<&str>,
    test_discovery_command: Option<&str>,
    model: Option<&str>,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(pipeline_name.as_bytes());
    hasher.update(b"\nsteps:");
    for step in steps {
        hasher.update(step.as_bytes());
        hasher.update(b"|");
    }
    hasher.update(b"\ncontext:");
    hasher.update(context_snapshot.as_bytes());
    hasher.update(b"\nrule:");
    hasher.update(rule_file.unwrap_or("").as_bytes());
    hasher.update(b"\ntest:");
    hasher.update(test_command.unwrap_or("").as_bytes());
    hasher.update(b"\ndiscovery:");
    hasher.update(test_discovery_command.unwrap_or("").as_bytes());
    hasher.update(b"\nmodel:");
    hasher.update(model.unwrap_or("").as_bytes());
    format!("{:x}", hasher.finalize())
}

#[derive(Debug, Serialize)]
struct StatusPayload {
    context_file: String,
    pipeline_name: Option<String>,
    run_id: Option<i64>,
    status: String,
    terminal_reason: Option<String>,
    started_at: Option<i64>,
    ended_at: Option<i64>,
    message: String,
    remediation: Option<String>,
    active_run_ids: Vec<i64>,
}

#[derive(Debug, Serialize)]
struct ActionResultPayload {
    action: String,
    context_file: String,
    pipeline_name: Option<String>,
    run_id: Option<i64>,
    status: String,
    terminal_reason: Option<String>,
    started_at: Option<i64>,
    ended_at: Option<i64>,
    message: String,
    remediation: Option<String>,
    active_run_ids: Vec<i64>,
}

#[derive(Debug, Serialize)]
struct RunsPayload {
    context_file: String,
    runs: Vec<RunListRow>,
}

#[derive(Debug, Serialize)]
struct RunListRow {
    run_id: i64,
    pipeline_name: String,
    status: String,
    terminal_reason: Option<String>,
    started_at: i64,
    ended_at: Option<i64>,
}

#[derive(Debug, Serialize)]
struct ActivePayload {
    context_file: String,
    pipeline_filter: Option<String>,
    active_run_ids: Vec<i64>,
    status: String,
    message: String,
}

#[derive(Debug, Serialize)]
struct ArtifactPayload {
    context_file: String,
    pipeline_name: String,
    run_id: i64,
    status: String,
    terminal_reason: Option<String>,
    started_at: Option<i64>,
    ended_at: Option<i64>,
    artifacts: Vec<ArtifactRow>,
}

#[derive(Debug, Serialize)]
struct ArtifactRow {
    artifact_id: i64,
    step_id: String,
    kind: String,
    reference: String,
    created_at: i64,
}

fn emit_json_or_text<T: Serialize>(format: OutputFormat, payload: &T) -> Result<()> {
    match format {
        OutputFormat::Json => {
            println!("{}", serde_json::to_string_pretty(payload)?);
        }
        OutputFormat::Text => {
            println!("{}", serde_json::to_string_pretty(payload)?);
        }
    }
    Ok(())
}

fn orchestration_active(
    context_file: &str,
    pipeline_filter: Option<&str>,
    format: OutputFormat,
) -> Result<()> {
    let store = OrchestrationStore::open(&default_orchestration_database_path())?;
    let active = store.list_active_runs_for_context(context_file, pipeline_filter)?;
    let payload = ActivePayload {
        context_file: context_file.to_string(),
        pipeline_filter: pipeline_filter.map(str::to_string),
        status: if active.is_empty() {
            "idle".to_string()
        } else {
            "running".to_string()
        },
        message: if active.is_empty() {
            "No active runs found for context.".to_string()
        } else {
            "Active runs found for context.".to_string()
        },
        active_run_ids: active,
    };
    emit_json_or_text(format, &payload)
}

fn orchestration_stop(
    context_file: &str,
    pipeline_filter: Option<&str>,
    format: OutputFormat,
) -> Result<()> {
    let store = OrchestrationStore::open(&default_orchestration_database_path())?;
    let Some((run_id, pipeline_name, runner_pid)) =
        store.stop_active_run_for_context(context_file, pipeline_filter, "stopped_by_operator")?
    else {
        bail!(
            "No active orchestration run found for context '{}'. Start one with `opennexus orchestration <pipeline> --context-file <path>`.",
            context_file
        );
    };

    let mut signal_result = "not_sent".to_string();
    if let Some(pid) = runner_pid {
        let status = std::process::Command::new("kill")
            .arg("-TERM")
            .arg(pid.to_string())
            .status();
        signal_result = match status {
            Ok(exit) if exit.success() => "sent".to_string(),
            Ok(_) => "failed".to_string(),
            Err(_) => "failed".to_string(),
        };
    }

    let payload = ActionResultPayload {
        action: "stop".to_string(),
        context_file: context_file.to_string(),
        pipeline_name: Some(pipeline_name),
        run_id: Some(run_id),
        status: "stopped".to_string(),
        terminal_reason: Some("stopped_by_operator".to_string()),
        started_at: None,
        ended_at: None,
        message: format!("Stopped active run. signal={}", signal_result),
        remediation: None,
        active_run_ids: vec![],
    };
    emit_json_or_text(format, &payload)
}

#[allow(clippy::too_many_arguments)]
fn orchestration_restart(
    format: OutputFormat,
    next_pipeline: &str,
    pipeline_file: Option<&str>,
    context_file: &str,
    max_iterations: usize,
    timeout_seconds: u64,
    rule_file: Option<&str>,
    test_command: Option<&str>,
    test_discovery_command: Option<&str>,
    model: Option<&str>,
    checkpoint_file: Option<&str>,
    allow_dependency_bypass: bool,
    run_id: Option<i64>,
    context_id_filter: Option<&str>,
    pipeline_filter: Option<&str>,
) -> Result<()> {
    let _ = orchestration_stop(context_file, pipeline_filter, OutputFormat::Json);
    run_orchestration_pipeline(
        format,
        next_pipeline,
        None,
        pipeline_file,
        Some(context_file),
        max_iterations,
        timeout_seconds,
        rule_file,
        test_command,
        test_discovery_command,
        model,
        checkpoint_file,
        None,
        allow_dependency_bypass,
        true,
        run_id,
        context_id_filter,
        pipeline_filter,
    )
}

fn orchestration_status(context_file: &str, format: OutputFormat) -> Result<()> {
    let store = OrchestrationStore::open(&default_orchestration_database_path())?;
    let active_runs = store.list_active_runs_for_context(context_file, None)?;
    if let Some((run_id, pipeline, status, terminal_reason, finished_at, started_at)) =
        store.latest_run_for_context(context_file)?
    {
        let payload = StatusPayload {
            context_file: context_file.to_string(),
            pipeline_name: Some(pipeline),
            run_id: Some(run_id),
            status,
            terminal_reason,
            started_at: Some(started_at),
            ended_at: finished_at,
            message: if active_runs.is_empty() {
                "Latest run loaded.".to_string()
            } else {
                "Active runs found for this context.".to_string()
            },
            remediation: None,
            active_run_ids: active_runs,
        };
        emit_json_or_text(format, &payload)?;
    } else {
        let payload = StatusPayload {
            context_file: context_file.to_string(),
            pipeline_name: None,
            run_id: None,
            status: "unknown".to_string(),
            terminal_reason: Some("no_runs".to_string()),
            started_at: None,
            ended_at: None,
            message: format!(
                "No orchestration runs found for context '{}'.",
                context_file
            ),
            remediation: Some(
                "Start one with `opennexus orchestration <pipeline> --context-file <path>`."
                    .to_string(),
            ),
            active_run_ids: vec![],
        };
        emit_json_or_text(format, &payload)?;
    }
    Ok(())
}

fn orchestration_runs(context_file: &str, format: OutputFormat) -> Result<()> {
    let store = OrchestrationStore::open(&default_orchestration_database_path())?;
    let runs = store.list_runs_for_context(context_file)?;
    if format == OutputFormat::Json {
        let payload = RunsPayload {
            context_file: context_file.to_string(),
            runs: runs
                .into_iter()
                .map(|run| RunListRow {
                    run_id: run.0,
                    pipeline_name: run.1,
                    status: run.2,
                    terminal_reason: run.3,
                    started_at: run.4,
                    ended_at: run.5,
                })
                .collect(),
        };
        println!("{}", serde_json::to_string_pretty(&payload)?);
        return Ok(());
    }
    if runs.is_empty() {
        println!(
            "No orchestration runs found for context '{}'.",
            context_file
        );
        return Ok(());
    }

    for run in runs {
        println!(
            "run_id={} pipeline={} status={} terminal={} started={} finished={}",
            run.0,
            run.1,
            run.2,
            run.3.unwrap_or_else(|| "n/a".to_string()),
            run.4,
            run.5.unwrap_or_default()
        );
    }
    Ok(())
}

fn orchestration_traces(context_file: &str, run_id: i64, format: OutputFormat) -> Result<()> {
    let store = OrchestrationStore::open(&default_orchestration_database_path())?;
    if !store.run_exists(run_id)? {
        bail!(
            "Unknown run id '{}'. Use `opennexus orchestration runs --context-file <path>` to list valid run ids.",
            run_id
        );
    }
    let run = store
        .get_run_by_id(run_id)?
        .context("Run metadata missing for requested run id.")?;
    if run.context_file != context_file {
        bail!(
            "Run {} does not belong to context file '{}'. Use matching --context-file value.",
            run_id,
            context_file
        );
    }

    if format == OutputFormat::Json {
        let traces = store.query_traces_for_run(run_id)?;
        let payload = TracePayload {
            context_file: run.context_file,
            pipeline_name: run.pipeline_name,
            run_id,
            status: run.status,
            terminal_reason: run.terminal_reason,
            started_at: Some(run.started_at),
            ended_at: run.finished_at,
            traces: traces.iter().map(TraceJsonRow::from).collect(),
        };
        println!("{}", serde_json::to_string_pretty(&payload)?);
        return Ok(());
    }

    let traces = store.list_traces_for_run(run_id)?;
    if traces.is_empty() {
        println!("No traces found for run {}.", run_id);
        return Ok(());
    }
    for trace in traces {
        println!(
            "trace_id={} step={} attempt={} status={} latency_ms={} tokens={} model={}",
            trace.0, trace.1, trace.2, trace.3, trace.4, trace.5, trace.6
        );
    }
    Ok(())
}

#[derive(Debug, Serialize)]
struct TimelineJsonRow {
    run: TimelineRunView,
    step: TimelineStepView,
    terminal: TimelineTerminalView,
    trace_refs: Vec<i64>,
    artifact_refs: Vec<String>,
}

#[derive(Debug, Serialize)]
struct TimelineRunView {
    id: i64,
    context_id: String,
    context_file: String,
    pipeline_name: String,
    status: String,
}

#[derive(Debug, Serialize)]
struct TimelineStepView {
    attempt_id: i64,
    step_id: String,
    attempt_index: i64,
    status: String,
    started_at: i64,
    finished_at: i64,
}

#[derive(Debug, Serialize)]
struct TimelineTerminalView {
    reason: Option<String>,
}

impl From<&TimelineRow> for TimelineJsonRow {
    fn from(value: &TimelineRow) -> Self {
        Self {
            run: TimelineRunView {
                id: value.run_id,
                context_id: value.context_id.clone(),
                context_file: value.context_file.clone(),
                pipeline_name: value.pipeline_name.clone(),
                status: value.run_status.clone(),
            },
            step: TimelineStepView {
                attempt_id: value.step_attempt_id,
                step_id: value.step_id.clone(),
                attempt_index: value.attempt_index,
                status: value.step_status.clone(),
                started_at: value.started_at,
                finished_at: value.finished_at,
            },
            terminal: TimelineTerminalView {
                reason: value.terminal_reason.clone(),
            },
            trace_refs: value.trace_ids.clone(),
            artifact_refs: value.artifact_refs.clone(),
        }
    }
}

#[derive(Debug, Serialize)]
struct TraceJsonRow {
    trace_id: i64,
    linkage: TraceLinkageView,
    model: String,
    status: String,
    terminal_status: Option<String>,
    latency_ms: i64,
    token_usage: i64,
    prompt_payload: String,
    response_payload: String,
    artifact_refs: Vec<String>,
}

#[derive(Debug, Serialize)]
struct TracePayload {
    context_file: String,
    pipeline_name: String,
    run_id: i64,
    status: String,
    terminal_reason: Option<String>,
    started_at: Option<i64>,
    ended_at: Option<i64>,
    traces: Vec<TraceJsonRow>,
}

#[derive(Debug, Serialize)]
struct TraceLinkageView {
    run_id: i64,
    step_attempt_id: Option<i64>,
    step_id: String,
    attempt_index: i64,
}

impl From<&TraceQueryRow> for TraceJsonRow {
    fn from(value: &TraceQueryRow) -> Self {
        Self {
            trace_id: value.trace_id,
            linkage: TraceLinkageView {
                run_id: value.run_id,
                step_attempt_id: value.step_attempt_id,
                step_id: value.step_id.clone(),
                attempt_index: value.attempt_index,
            },
            model: value.model.clone(),
            status: value.status.clone(),
            terminal_status: value.terminal_status.clone(),
            latency_ms: value.latency_ms,
            token_usage: value.token_usage,
            prompt_payload: value.prompt_payload.clone(),
            response_payload: value.response_payload.clone(),
            artifact_refs: value.artifact_refs.clone(),
        }
    }
}

fn orchestration_artifacts(context_file: &str, run_id: i64, format: OutputFormat) -> Result<()> {
    let store = OrchestrationStore::open(&default_orchestration_database_path())?;
    if !store.run_exists(run_id)? {
        bail!(
            "Unknown run id '{}'. Use `opennexus orchestration runs --context-file <path>` to list valid run ids.",
            run_id
        );
    }
    let artifacts = store.list_artifacts_for_run(run_id)?;
    let run = store
        .get_run_by_id(run_id)?
        .context("Run metadata missing for requested run id.")?;
    if run.context_file != context_file {
        bail!(
            "Run {} does not belong to context file '{}'. Use matching --context-file value.",
            run_id,
            context_file
        );
    }
    if format == OutputFormat::Json {
        let payload = ArtifactPayload {
            context_file: run.context_file,
            pipeline_name: run.pipeline_name,
            run_id,
            status: run.status,
            terminal_reason: run.terminal_reason,
            started_at: Some(run.started_at),
            ended_at: run.finished_at,
            artifacts: artifacts
                .into_iter()
                .map(|item| ArtifactRow {
                    artifact_id: item.0,
                    step_id: item.1,
                    kind: item.2,
                    reference: item.3,
                    created_at: item.4,
                })
                .collect(),
        };
        println!("{}", serde_json::to_string_pretty(&payload)?);
        return Ok(());
    }
    if artifacts.is_empty() {
        println!("No artifacts found for run {}.", run_id);
        return Ok(());
    }
    for artifact in artifacts {
        println!(
            "artifact_id={} step={} kind={} ref={} created_at={}",
            artifact.0, artifact.1, artifact.2, artifact.3, artifact.4
        );
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trace_json_row_includes_prompt_response_latency_token_and_linkage() {
        let source = TraceQueryRow {
            trace_id: 7,
            run_id: 2,
            step_attempt_id: Some(11),
            step_id: "coder_iteration".to_string(),
            attempt_index: 1,
            model: "opencode/default".to_string(),
            prompt_payload: "prompt".to_string(),
            response_payload: "response".to_string(),
            status: "success".to_string(),
            terminal_status: Some("success".to_string()),
            latency_ms: 15,
            token_usage: 88,
            artifact_refs: vec!["artifact://x".to_string()],
        };

        let rendered = TraceJsonRow::from(&source);
        let value = serde_json::to_value(&rendered).expect("serialize");
        assert_eq!(value["trace_id"], 7);
        assert_eq!(value["linkage"]["run_id"], 2);
        assert_eq!(value["prompt_payload"], "prompt");
        assert_eq!(value["response_payload"], "response");
        assert_eq!(value["latency_ms"], 15);
        assert_eq!(value["token_usage"], 88);
    }

    #[test]
    fn timeline_json_row_groups_run_step_terminal_and_refs() {
        let source = TimelineRow {
            run_id: 9,
            context_id: "ORC_009".to_string(),
            context_file: ".nexus/context/nexus-cli/orchestration/ORC_009.md".to_string(),
            pipeline_name: "default".to_string(),
            run_status: "success".to_string(),
            step_attempt_id: 13,
            step_id: "coder_iteration".to_string(),
            attempt_index: 1,
            step_status: "success".to_string(),
            terminal_reason: Some("done".to_string()),
            started_at: 10,
            finished_at: 12,
            trace_ids: vec![4, 5],
            artifact_refs: vec!["artifact://a".to_string()],
        };

        let rendered = TimelineJsonRow::from(&source);
        let value = serde_json::to_value(&rendered).expect("serialize");
        assert_eq!(value["run"]["id"], 9);
        assert_eq!(value["step"]["attempt_id"], 13);
        assert_eq!(value["terminal"]["reason"], "done");
        assert_eq!(value["trace_refs"], serde_json::json!([4, 5]));
        assert_eq!(value["artifact_refs"], serde_json::json!(["artifact://a"]));
    }

    #[test]
    fn status_payload_json_includes_required_control_fields() {
        let payload = StatusPayload {
            context_file: ".nexus/context/demo/CTX_001.md".to_string(),
            pipeline_name: Some("default".to_string()),
            run_id: Some(44),
            status: "running".to_string(),
            terminal_reason: None,
            started_at: Some(100),
            ended_at: None,
            message: "active".to_string(),
            remediation: None,
            active_run_ids: vec![44],
        };
        let value = serde_json::to_value(payload).expect("serialize");
        assert_eq!(value["context_file"], ".nexus/context/demo/CTX_001.md");
        assert_eq!(value["pipeline_name"], "default");
        assert_eq!(value["run_id"], 44);
        assert_eq!(value["status"], "running");
        assert_eq!(value["started_at"], 100);
    }

    #[test]
    fn action_result_payload_json_includes_required_control_fields() {
        let payload = ActionResultPayload {
            action: "stop".to_string(),
            context_file: ".nexus/context/demo/CTX_001.md".to_string(),
            pipeline_name: Some("default".to_string()),
            run_id: Some(45),
            status: "stopped".to_string(),
            terminal_reason: Some("stopped_by_operator".to_string()),
            started_at: Some(100),
            ended_at: Some(110),
            message: "Stopped active run.".to_string(),
            remediation: None,
            active_run_ids: vec![],
        };
        let value = serde_json::to_value(payload).expect("serialize");
        assert_eq!(value["action"], "stop");
        assert_eq!(value["context_file"], ".nexus/context/demo/CTX_001.md");
        assert_eq!(value["run_id"], 45);
        assert_eq!(value["status"], "stopped");
        assert_eq!(value["terminal_reason"], "stopped_by_operator");
    }
}
