use anyhow::{bail, Context, Result};
use regex::Regex;
use std::collections::BTreeMap;
use std::fs;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::adapters::agents::{agent_label, build_invocation, resolve_command};
use crate::config::opencode::ensure_ralph_opencode_config;
use crate::core::ralph::model::{
    AgentType, IterationHistory, ParsedRunOptions, RalphHistory, RalphOperation, RalphState,
};
use crate::features::ralph::parser::{help_text, VERSION};
use crate::services::git::{auto_commit, modified_since, snapshot_files};
use crate::services::process::{run_command, ActiveChild};
use crate::services::ralph_fs::{
    append_context, clear_context, clear_history, clear_state, load_context, load_history,
    load_state, save_history, save_state, RalphPaths,
};
use crate::utils::text::{format_duration_long, format_duration_short};

pub fn execute(operation: RalphOperation) -> Result<()> {
    let paths = RalphPaths::in_cwd();
    match operation {
        RalphOperation::Help => {
            println!("{}", help_text());
            Ok(())
        }
        RalphOperation::Version => {
            println!("ralph {}", VERSION);
            Ok(())
        }
        RalphOperation::Status { show_tasks } => show_status(&paths, show_tasks),
        RalphOperation::AddContext { text } => add_context(&paths, &text),
        RalphOperation::ClearContext => clear_context_cmd(&paths),
        RalphOperation::ListTasks => list_tasks(&paths),
        RalphOperation::AddTask { description } => add_task(&paths, &description),
        RalphOperation::RemoveTask { index } => remove_task(&paths, index),
        RalphOperation::Run(options) => run_loop(&paths, options),
    }
}

fn show_status(paths: &RalphPaths, show_tasks: bool) -> Result<()> {
    let state = load_state(paths);
    let history = load_history(paths);
    let context = load_context(paths);

    println!("Ralph Wiggum Status");
    println!("===================");

    if let Some(state) = state {
        if state.active {
            let elapsed = now_ms().saturating_sub(parse_ms(&state.started_at));
            println!("- Active: yes");
            println!(
                "- Iteration: {}{}",
                state.iteration,
                if state.max_iterations > 0 {
                    format!(" / {}", state.max_iterations)
                } else {
                    " (unlimited)".to_string()
                }
            );
            println!("- Elapsed: {}", format_duration_long(elapsed));
            println!("- Promise: {}", state.completion_promise);
            println!("- Agent: {}", agent_label(state.agent));
            if !state.model.is_empty() {
                println!("- Model: {}", state.model);
            }
            let prompt_preview = state.prompt.replace('\n', " ");
            println!(
                "- Prompt: {}",
                if prompt_preview.len() > 80 {
                    format!("{}...", &prompt_preview[..80])
                } else {
                    prompt_preview
                }
            );
            if !state.rotation.is_empty() {
                println!(
                    "- Rotation: enabled ({}/{})",
                    state.rotation_index + 1,
                    state.rotation.len()
                );
            }
        } else {
            println!("- Active: no");
        }
    } else {
        println!("- Active: no");
    }

    if let Some(context) = context {
        println!("\nPending Context:");
        for line in context.lines() {
            println!("  {}", line);
        }
    }

    if show_tasks || load_state(paths).map(|s| s.tasks_mode).unwrap_or(false) {
        println!("\nTasks:");
        if !paths.tasks_file.exists() {
            println!("  no tasks file found");
        } else {
            let tasks = parse_tasks(&fs::read_to_string(&paths.tasks_file).unwrap_or_default());
            if tasks.is_empty() {
                println!("  no tasks found");
            } else {
                for (idx, task) in tasks.iter().enumerate() {
                    println!("  {}. {} {}", idx + 1, status_icon(&task.status), task.text);
                }
            }
        }
    }

    if !history.iterations.is_empty() {
        println!("\nHistory:");
        println!("- Iterations: {}", history.iterations.len());
        println!(
            "- Total time: {}",
            format_duration_long(history.total_duration_ms)
        );
        for item in history.iterations.iter().rev().take(5).rev() {
            println!(
                "  #{} {} {} / {}",
                item.iteration,
                format_duration_short(item.duration_ms),
                item.agent.as_str(),
                item.model
            );
        }
    }

    Ok(())
}

fn add_context(paths: &RalphPaths, text: &str) -> Result<()> {
    append_context(paths, text)?;
    println!("Context added for next iteration");
    if let Some(state) = load_state(paths) {
        if state.active {
            println!("Will be picked up in iteration {}", state.iteration + 1);
        }
    }
    Ok(())
}

fn clear_context_cmd(paths: &RalphPaths) -> Result<()> {
    if paths.context_file.exists() {
        clear_context(paths);
        println!("Context cleared");
    } else {
        println!("No pending context to clear");
    }
    Ok(())
}

fn list_tasks(paths: &RalphPaths) -> Result<()> {
    if !paths.tasks_file.exists() {
        println!("No tasks file found. Use --add-task to create your first task.");
        return Ok(());
    }
    let content = fs::read_to_string(&paths.tasks_file)?;
    let tasks = parse_tasks(&content);
    if tasks.is_empty() {
        println!("No tasks found.");
        return Ok(());
    }
    for (idx, task) in tasks.iter().enumerate() {
        println!("{}. {} {}", idx + 1, status_icon(&task.status), task.text);
        for sub in &task.subtasks {
            println!("   {} {}", status_icon(&sub.status), sub.text);
        }
    }
    Ok(())
}

fn add_task(paths: &RalphPaths, description: &str) -> Result<()> {
    fs::create_dir_all(&paths.state_dir)?;
    let current = if paths.tasks_file.exists() {
        fs::read_to_string(&paths.tasks_file)?
    } else {
        "# Ralph Tasks\n\n".to_string()
    };
    let updated = format!("{}\n- [ ] {}\n", current.trim_end(), description);
    fs::write(&paths.tasks_file, updated)?;
    println!("Task added: \"{}\"", description);
    Ok(())
}

fn remove_task(paths: &RalphPaths, index: usize) -> Result<()> {
    if !paths.tasks_file.exists() {
        bail!("Error: No tasks file found");
    }
    let content = fs::read_to_string(&paths.tasks_file)?;
    let lines: Vec<String> = content.lines().map(str::to_string).collect();
    let top_task_indexes: Vec<usize> = lines
        .iter()
        .enumerate()
        .filter_map(|(idx, line)| line.starts_with("- [").then_some(idx))
        .collect();
    if index == 0 || index > top_task_indexes.len() {
        bail!(
            "Error: Task index {} is out of range (1-{})",
            index,
            top_task_indexes.len()
        );
    }

    let remove_start = top_task_indexes[index - 1];
    let remove_end = top_task_indexes.get(index).copied().unwrap_or(lines.len());
    let mut kept = Vec::new();
    for (line_idx, line) in lines.iter().enumerate() {
        if line_idx >= remove_start && line_idx < remove_end {
            continue;
        }
        kept.push(line.clone());
    }
    fs::write(&paths.tasks_file, format!("{}\n", kept.join("\n")))?;
    println!("Removed task {} and its nested content", index);
    Ok(())
}

fn run_loop(paths: &RalphPaths, mut options: ParsedRunOptions) -> Result<()> {
    let mut state = if let Some(existing) = load_state(paths) {
        if existing.active {
            if options.prompt.trim().is_empty() {
                options.prompt = existing.prompt.clone();
            }
            existing
        } else {
            init_state(&options)
        }
    } else {
        init_state(&options)
    };

    if options.prompt.trim().is_empty() && state.prompt.trim().is_empty() {
        bail!(
            "Error: No prompt provided\nUsage: opennexus ralph \"Your task description\" [options]"
        );
    }
    if state.prompt.trim().is_empty() {
        state.prompt = options.prompt.clone();
    }

    if !state.rotation.is_empty() {
        for entry in &state.rotation {
            validate_agent_binary(entry.agent)?;
        }
    } else {
        validate_agent_binary(state.agent)?;
    }

    if state.disable_plugins {
        for agent in [AgentType::ClaudeCode, AgentType::Codex, AgentType::Copilot] {
            if state.agent == agent {
                eprintln!(
                    "Warning: --no-plugins has no effect with {}",
                    agent_label(agent)
                );
            }
        }
    }

    if state.tasks_mode && !paths.tasks_file.exists() {
        fs::create_dir_all(&paths.state_dir)?;
        fs::write(
            &paths.tasks_file,
            "# Ralph Tasks\n\nAdd your tasks below using: `opennexus ralph --add-task \"description\"`\n",
        )?;
    }

    if !state.active {
        state.active = true;
    }
    save_state(paths, &state)?;

    let mut history = load_history(paths);
    let interrupted = Arc::new(AtomicBool::new(false));
    let active_child = ActiveChild::new();
    {
        let interrupted = Arc::clone(&interrupted);
        let active_child = active_child.clone();
        ctrlc::set_handler(move || {
            interrupted.store(true, Ordering::Relaxed);
            active_child.kill();
        })
        .ok();
    }

    println!("Ralph Wiggum Loop");
    println!("=================");
    if !options.prompt_source.is_empty() {
        println!("Task: {}", options.prompt_source);
    }
    println!("Completion promise: {}", state.completion_promise);
    println!(
        "Max iterations: {}",
        if state.max_iterations > 0 {
            state.max_iterations.to_string()
        } else {
            "unlimited".to_string()
        }
    );
    println!("Starting loop... (Ctrl+C to stop)");

    loop {
        if interrupted.load(Ordering::Relaxed) {
            clear_state(paths);
            println!("Loop cancelled.");
            break;
        }
        if state.max_iterations > 0 && state.iteration > state.max_iterations {
            println!(
                "Max iterations ({}) reached. Loop stopped.",
                state.max_iterations
            );
            clear_state(paths);
            break;
        }

        let context_at_start = load_context(paths);
        let snapshot_before = snapshot_files();
        let (agent, model) = resolve_agent_model(&state);
        let prompt = build_prompt(paths, &state, &context_at_start)?;
        let opencode_config = if agent == AgentType::Opencode
            && (state.disable_plugins || state.allow_all_permissions)
        {
            Some(
                ensure_ralph_opencode_config(
                    paths,
                    state.disable_plugins,
                    state.allow_all_permissions,
                )?
                .to_string_lossy()
                .to_string(),
            )
        } else {
            None
        };
        let invocation = build_invocation(
            agent,
            &prompt,
            &model,
            state.allow_all_permissions,
            &state.extra_agent_flags,
            state.stream_output,
            opencode_config,
        );

        println!("\nIteration {}", state.iteration);
        println!("----------------------------");

        let started = now_ms();
        let result = run_command(
            &invocation.command,
            &invocation.args,
            &invocation.env,
            agent,
            state.stream_output,
            state.verbose_tools,
            Arc::clone(&interrupted),
            active_child.clone(),
        );
        let ended = now_ms();

        match result {
            Ok(result) => {
                let combined = format!("{}\n{}", result.stdout, result.stderr);
                if agent == AgentType::Opencode && detect_placeholder_plugin_error(&combined) {
                    clear_state(paths);
                    bail!("OpenCode loaded legacy ralph-wiggum plugin. Remove plugin or use --no-plugins");
                }
                if detect_model_not_found_error(&combined) {
                    clear_state(paths);
                    bail!("Model configuration error detected. Configure model or pass --model");
                }

                let completion = check_promise(&combined, &state.completion_promise);
                let abort = !state.abort_promise.is_empty()
                    && check_promise(&combined, &state.abort_promise);
                let _task_promise = state.tasks_mode
                    && check_promise(&combined, &state.task_promise)
                    && !completion;

                let snapshot_after = snapshot_files();
                let modified = modified_since(&snapshot_before, &snapshot_after);
                let errors = extract_errors(&combined);
                let duration = ended.saturating_sub(started);

                let mut tools = BTreeMap::new();
                for (key, value) in result.tools {
                    tools.insert(key, value);
                }

                history.iterations.push(IterationHistory {
                    iteration: state.iteration,
                    started_at: format!("{}", started),
                    ended_at: format!("{}", ended),
                    duration_ms: duration,
                    agent,
                    model: model.clone(),
                    tools_used: tools,
                    files_modified: modified.clone(),
                    exit_code: result.exit_code,
                    completion_detected: completion,
                    errors: errors.clone(),
                });
                history.total_duration_ms += duration;
                update_struggle(&mut history, &modified, duration, &errors);
                save_history(paths, &history)?;

                println!(
                    "Iteration {} completed in {} ({} / {})",
                    state.iteration,
                    format_duration_short(duration),
                    agent.as_str(),
                    if model.is_empty() { "default" } else { &model }
                );

                if result.exit_code != 0 {
                    eprintln!(
                        "Warning: {} exited with code {}. Continuing.",
                        agent_label(agent),
                        result.exit_code
                    );
                }

                if abort {
                    println!(
                        "Abort signal detected: <promise>{}</promise>",
                        state.abort_promise
                    );
                    clear_state(paths);
                    clear_history(paths);
                    clear_context(paths);
                    std::process::exit(1);
                }

                if completion {
                    if state.iteration < state.min_iterations {
                        println!(
                            "Completion detected before min iterations ({}). Continuing.",
                            state.min_iterations
                        );
                    } else {
                        println!(
                            "Completion promise detected: <promise>{}</promise>",
                            state.completion_promise
                        );
                        clear_state(paths);
                        clear_history(paths);
                        clear_context(paths);
                        break;
                    }
                }

                if context_at_start.is_some() {
                    clear_context(paths);
                }

                if state.auto_commit {
                    auto_commit(state.iteration);
                }
            }
            Err(error) => {
                let ended = now_ms();
                let duration = ended.saturating_sub(started);
                history.iterations.push(IterationHistory {
                    iteration: state.iteration,
                    started_at: format!("{}", started),
                    ended_at: format!("{}", ended),
                    duration_ms: duration,
                    agent,
                    model,
                    tools_used: BTreeMap::new(),
                    files_modified: Vec::new(),
                    exit_code: -1,
                    completion_detected: false,
                    errors: vec![error.to_string()],
                });
                history.total_duration_ms += duration;
                save_history(paths, &history)?;
                eprintln!("Error in iteration {}: {}", state.iteration, error);
                eprintln!("Continuing to next iteration...");
            }
        }

        if !state.rotation.is_empty() {
            state.rotation_index = (state.rotation_index + 1) % state.rotation.len();
        }
        state.iteration += 1;
        save_state(paths, &state)?;
        std::thread::sleep(Duration::from_secs(1));
    }

    Ok(())
}

fn validate_agent_binary(agent: AgentType) -> Result<()> {
    let command = resolve_command(agent);
    let status = Command::new("sh")
        .arg("-c")
        .arg(format!("command -v {} >/dev/null 2>&1", command))
        .status()
        .with_context(|| format!("Unable to validate agent binary '{}'", command))?;
    if status.success() {
        return Ok(());
    }
    bail!(
        "{} CLI ('{}') not found. Install it or configure RALPH_*_BINARY.",
        agent_label(agent),
        command
    )
}

fn init_state(options: &ParsedRunOptions) -> RalphState {
    RalphState {
        active: true,
        iteration: 1,
        min_iterations: options.min_iterations,
        max_iterations: options.max_iterations,
        completion_promise: options.completion_promise.clone(),
        abort_promise: options.abort_promise.clone(),
        tasks_mode: options.tasks_mode,
        task_promise: options.task_promise.clone(),
        prompt: options.prompt.clone(),
        prompt_template: options.prompt_template.clone(),
        started_at: format!("{}", now_ms()),
        model: options.model.clone(),
        agent: options.agent,
        rotation: options.rotation.clone(),
        rotation_index: 0,
        auto_commit: options.auto_commit,
        disable_plugins: options.disable_plugins,
        allow_all_permissions: options.allow_all_permissions,
        stream_output: options.stream_output,
        verbose_tools: options.verbose_tools,
        extra_agent_flags: options.extra_agent_flags.clone(),
    }
}

fn resolve_agent_model(state: &RalphState) -> (AgentType, String) {
    if state.rotation.is_empty() {
        return (state.agent, state.model.clone());
    }
    let index = state.rotation_index % state.rotation.len();
    let entry = &state.rotation[index];
    (entry.agent, entry.model.clone())
}

fn build_prompt(
    paths: &RalphPaths,
    state: &RalphState,
    context: &Option<String>,
) -> Result<String> {
    if !state.prompt_template.is_empty() {
        let template = fs::read_to_string(&state.prompt_template)
            .with_context(|| format!("Prompt template not found: {}", state.prompt_template))?;
        let max_iterations = if state.max_iterations > 0 {
            state.max_iterations.to_string()
        } else {
            "unlimited".to_string()
        };
        let iteration = state.iteration.to_string();
        let min_iterations = state.min_iterations.to_string();
        let tasks = if paths.tasks_file.exists() {
            fs::read_to_string(&paths.tasks_file).unwrap_or_default()
        } else {
            String::new()
        };
        let rendered = template
            .replace("{{iteration}}", &iteration)
            .replace("{{max_iterations}}", &max_iterations)
            .replace("{{min_iterations}}", &min_iterations)
            .replace("{{prompt}}", &state.prompt)
            .replace("{{completion_promise}}", &state.completion_promise)
            .replace("{{abort_promise}}", &state.abort_promise)
            .replace("{{task_promise}}", &state.task_promise)
            .replace("{{context}}", context.as_deref().unwrap_or(""))
            .replace("{{tasks}}", &tasks);
        return Ok(rendered);
    }

    let context_section = context
        .as_ref()
        .map(|value| format!("\n## Additional Context\n\n{}\n", value))
        .unwrap_or_default();

    if state.tasks_mode {
        let tasks_section = tasks_prompt_section(paths, state);
        return Ok(format!(
            "# Ralph Wiggum Loop - Iteration {}\n\nYou are in an iterative development loop working through a task list.{}\n{}\n## Your Main Goal\n\n{}\n\n## Critical Rules\n\n- Work on ONE task at a time from .ralph/ralph-tasks.md\n- ONLY output <promise>{}</promise> when current task is complete\n- ONLY output <promise>{}</promise> when ALL tasks are complete\n- Output promise tags directly\n- Do not output false promises\n",
            state.iteration,
            context_section,
            tasks_section,
            state.prompt,
            state.task_promise,
            state.completion_promise
        ));
    }

    Ok(format!(
        "# Ralph Wiggum Loop - Iteration {}\n\nYou are in an iterative development loop.{}\n## Your Task\n\n{}\n\n## Instructions\n\n1. Read files and understand current state\n2. Make progress on the task\n3. Verify your changes\n4. When truly complete, output: <promise>{}</promise>\n",
        state.iteration, context_section, state.prompt, state.completion_promise
    ))
}

fn tasks_prompt_section(paths: &RalphPaths, state: &RalphState) -> String {
    if !paths.tasks_file.exists() {
        return "## TASKS MODE\n\nNo tasks file found. Create .ralph/ralph-tasks.md or use --add-task.\n".to_string();
    }
    let content = fs::read_to_string(&paths.tasks_file).unwrap_or_default();
    let tasks = parse_tasks(&content);
    if tasks.is_empty() {
        return "## TASKS MODE\n\nNo tasks found. Add tasks to .ralph/ralph-tasks.md.\n"
            .to_string();
    }
    let current = tasks.iter().find(|task| task.status == "in-progress");
    let next = tasks.iter().find(|task| task.status == "todo");
    let summary = if let Some(task) = current {
        format!("Current task: {}", task.text)
    } else if let Some(task) = next {
        format!("Next task: {}", task.text)
    } else {
        format!(
            "All tasks appear complete. Output <promise>{}</promise> if verified.",
            state.completion_promise
        )
    };
    format!(
        "## TASKS MODE\n\n{}\n\n```markdown\n{}\n```\n",
        summary,
        content.trim()
    )
}

fn detect_placeholder_plugin_error(output: &str) -> bool {
    output.contains("ralph-wiggum is not yet ready for use. This is a placeholder package.")
}

fn detect_model_not_found_error(output: &str) -> bool {
    output.contains("ProviderModelNotFoundError")
        || output.contains("Provider returned error")
        || output.to_ascii_lowercase().contains("model not found")
        || output.contains("No model configured")
}

fn check_promise(output: &str, promise: &str) -> bool {
    let escaped = regex::escape(promise);
    let re = Regex::new(&format!(r"<promise>\s*{}\s*</promise>", escaped)).expect("promise regex");
    for m in re.find_iter(output) {
        let start = m.start().saturating_sub(100);
        let context = output[start..m.start()].to_ascii_lowercase();
        let negated = [
            "not output",
            "don't output",
            "won't output",
            "will not output",
            "not say",
            "don't say",
            "won't say",
            "will not say",
        ]
        .iter()
        .any(|pattern| context.contains(pattern));
        if negated {
            continue;
        }
        let quote_count = context.matches('"').count() + context.matches('`').count();
        if quote_count % 2 == 1 {
            continue;
        }
        return true;
    }
    false
}

fn extract_errors(output: &str) -> Vec<String> {
    let mut errors = Vec::<String>::new();
    for line in output.lines() {
        let lower = line.to_ascii_lowercase();
        if lower.contains("error:")
            || lower.contains("failed:")
            || lower.contains("exception:")
            || lower.contains("typeerror")
            || lower.contains("syntaxerror")
            || lower.contains("referenceerror")
            || (lower.contains("test") && lower.contains("fail"))
        {
            let trimmed = line.trim();
            if !trimmed.is_empty() && !errors.iter().any(|item| item == trimmed) {
                errors.push(trimmed.chars().take(200).collect());
            }
        }
    }
    errors.truncate(10);
    errors
}

fn update_struggle(
    history: &mut RalphHistory,
    files_modified: &[String],
    duration: u128,
    errors: &[String],
) {
    if files_modified.is_empty() {
        history.struggle_indicators.no_progress_iterations += 1;
    } else {
        history.struggle_indicators.no_progress_iterations = 0;
    }

    if duration < 30_000 {
        history.struggle_indicators.short_iterations += 1;
    } else {
        history.struggle_indicators.short_iterations = 0;
    }

    if errors.is_empty() {
        history.struggle_indicators.repeated_errors.clear();
    } else {
        for err in errors {
            let key: String = err.chars().take(100).collect();
            *history
                .struggle_indicators
                .repeated_errors
                .entry(key)
                .or_insert(0) += 1;
        }
    }
}

#[derive(Debug, Clone)]
struct ParsedTask {
    text: String,
    status: String,
    subtasks: Vec<ParsedTask>,
}

fn parse_tasks(content: &str) -> Vec<ParsedTask> {
    let mut tasks = Vec::<ParsedTask>::new();
    let top_re = Regex::new(r"^- \[([ x/])\]\s*(.+)").expect("top regex");
    let sub_re = Regex::new(r"^\s+- \[([ x/])\]\s*(.+)").expect("sub regex");
    for line in content.lines() {
        if let Some(cap) = top_re.captures(line) {
            let status = capture_status(cap.get(1).map(|m| m.as_str()).unwrap_or(" "));
            let text = cap.get(2).map(|m| m.as_str()).unwrap_or("").to_string();
            tasks.push(ParsedTask {
                text,
                status,
                subtasks: Vec::new(),
            });
            continue;
        }
        if let Some(cap) = sub_re.captures(line) {
            if let Some(current) = tasks.last_mut() {
                let status = capture_status(cap.get(1).map(|m| m.as_str()).unwrap_or(" "));
                let text = cap.get(2).map(|m| m.as_str()).unwrap_or("").to_string();
                current.subtasks.push(ParsedTask {
                    text,
                    status,
                    subtasks: Vec::new(),
                });
            }
        }
    }
    tasks
}

fn capture_status(value: &str) -> String {
    match value {
        "x" => "complete".to_string(),
        "/" => "in-progress".to_string(),
        _ => "todo".to_string(),
    }
}

fn status_icon(status: &str) -> &'static str {
    match status {
        "complete" => "[x]",
        "in-progress" => "[/]",
        _ => "[ ]",
    }
}

fn parse_ms(value: &str) -> u128 {
    value.parse::<u128>().unwrap_or(0)
}

fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detects_exact_completion_promise_tag() {
        assert!(check_promise(
            "done <promise>COMPLETE</promise>",
            "COMPLETE"
        ));
        assert!(!check_promise("<promise>DONE</promise>", "COMPLETE"));
    }

    #[test]
    fn rejects_negated_completion_mentions() {
        assert!(!check_promise(
            "I will not output <promise>COMPLETE</promise> yet",
            "COMPLETE"
        ));
    }

    #[test]
    fn parses_markdown_tasks_with_subtasks() {
        let tasks = parse_tasks("- [ ] top\n  - [x] child\n");
        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].subtasks.len(), 1);
        assert_eq!(tasks[0].subtasks[0].status, "complete");
    }
}
