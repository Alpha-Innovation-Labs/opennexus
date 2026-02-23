use anyhow::{bail, Result};
use std::fs;
use std::path::Path;

use crate::core::ralph::model::{AgentType, ParsedRunOptions, RalphOperation, RotationEntry};

pub const VERSION: &str = "1.2.1";

pub fn help_text() -> String {
    format!(
        "Ralph Wiggum Loop - Iterative AI development with AI agents\n\nUsage:\n  opennexus ralph \"<prompt>\" [options]\n  opennexus ralph --prompt-file <path> [options]\n\nOptions:\n  --agent AGENT       AI agent: opencode (default), claude-code, codex, copilot\n  --min-iterations N  Minimum iterations before completion allowed (default: 1)\n  --max-iterations N  Maximum iterations before stopping (default: unlimited)\n  --completion-promise TEXT  Completion signal (default: COMPLETE)\n  --abort-promise TEXT  Early abort signal\n  --tasks, -t         Enable Tasks Mode\n  --task-promise TEXT Tasks completion signal (default: READY_FOR_NEXT_TASK)\n  --model MODEL       Model name\n  --rotation LIST     Comma-separated agent:model entries\n  --prompt-file, --file, -f  Load prompt from file\n  --prompt-template PATH  Custom prompt template\n  --no-stream         Buffer output\n  --verbose-tools     Print all tool lines\n  --no-plugins        Disable non-auth OpenCode plugins\n  --no-commit         Disable auto commit\n  --allow-all         Auto approve permissions (default)\n  --no-allow-all      Interactive permissions\n  --status            Show active loop status\n  --status --tasks    Show status with tasks\n  --add-context TEXT  Append context for next iteration\n  --clear-context     Clear pending context\n  --list-tasks        Show indexed markdown tasks\n  --add-task TEXT     Add a top-level task\n  --remove-task N     Remove indexed task and nested content\n  --version, -v       Show version\n  --help, -h          Show this help\n  --                  Forward remaining args to agent\n\nVersion: ralph {}\n",
        VERSION
    )
}

pub fn parse_operation(raw_args: &[String]) -> Result<RalphOperation> {
    if raw_args.iter().any(|arg| arg == "--help" || arg == "-h") {
        return Ok(RalphOperation::Help);
    }
    if raw_args.iter().any(|arg| arg == "--version" || arg == "-v") {
        return Ok(RalphOperation::Version);
    }
    if let Some(value) = option_value(raw_args, "--add-context") {
        if value.is_empty() {
            bail!("Error: --add-context requires a text argument");
        }
        return Ok(RalphOperation::AddContext {
            text: value.to_string(),
        });
    }
    if raw_args.iter().any(|arg| arg == "--clear-context") {
        return Ok(RalphOperation::ClearContext);
    }
    if raw_args.iter().any(|arg| arg == "--list-tasks") {
        return Ok(RalphOperation::ListTasks);
    }
    if let Some(value) = option_value(raw_args, "--add-task") {
        if value.is_empty() {
            bail!("Error: --add-task requires a description");
        }
        return Ok(RalphOperation::AddTask {
            description: value.to_string(),
        });
    }
    if let Some(value) = option_value(raw_args, "--remove-task") {
        let index = value
            .parse::<usize>()
            .map_err(|_| anyhow::anyhow!("Error: --remove-task requires a valid number"))?;
        return Ok(RalphOperation::RemoveTask { index });
    }
    if raw_args.iter().any(|arg| arg == "--status") {
        let show_tasks = raw_args.iter().any(|arg| arg == "--tasks" || arg == "-t");
        return Ok(RalphOperation::Status { show_tasks });
    }

    parse_run(raw_args).map(RalphOperation::Run)
}

fn parse_run(raw_args: &[String]) -> Result<ParsedRunOptions> {
    let mut args = raw_args.to_vec();
    let mut extra_agent_flags = Vec::new();
    if let Some(index) = args.iter().position(|arg| arg == "--") {
        extra_agent_flags = args[index + 1..].to_vec();
        args.truncate(index);
    }

    let mut min_iterations = 1usize;
    let mut max_iterations = 0usize;
    let mut completion_promise = "COMPLETE".to_string();
    let mut abort_promise = String::new();
    let mut task_promise = "READY_FOR_NEXT_TASK".to_string();
    let mut model = String::new();
    let mut agent = AgentType::Opencode;
    let mut rotation = Vec::<RotationEntry>::new();
    let mut prompt_file = String::new();
    let mut prompt_template = String::new();
    let mut stream_output = true;
    let mut verbose_tools = false;
    let mut auto_commit = true;
    let mut disable_plugins = false;
    let mut allow_all_permissions = true;
    let mut tasks_mode = false;
    let mut prompt_parts = Vec::<String>::new();

    let mut i = 0usize;
    while i < args.len() {
        let arg = &args[i];
        match arg.as_str() {
            "--agent" => {
                i += 1;
                let value = args
                    .get(i)
                    .ok_or_else(|| anyhow::anyhow!("Error: --agent requires a value"))?;
                agent = AgentType::from_str(value).ok_or_else(|| {
                    anyhow::anyhow!(
                        "Error: --agent requires: opencode, claude-code, codex, or copilot"
                    )
                })?;
            }
            "--min-iterations" => {
                i += 1;
                let value = args
                    .get(i)
                    .ok_or_else(|| anyhow::anyhow!("Error: --min-iterations requires a number"))?;
                min_iterations = value
                    .parse::<usize>()
                    .map_err(|_| anyhow::anyhow!("Error: --min-iterations requires a number"))?;
            }
            "--max-iterations" => {
                i += 1;
                let value = args
                    .get(i)
                    .ok_or_else(|| anyhow::anyhow!("Error: --max-iterations requires a number"))?;
                max_iterations = value
                    .parse::<usize>()
                    .map_err(|_| anyhow::anyhow!("Error: --max-iterations requires a number"))?;
            }
            "--completion-promise" => {
                i += 1;
                completion_promise = args
                    .get(i)
                    .ok_or_else(|| anyhow::anyhow!("Error: --completion-promise requires a value"))?
                    .to_string();
            }
            "--abort-promise" => {
                i += 1;
                abort_promise = args
                    .get(i)
                    .ok_or_else(|| anyhow::anyhow!("Error: --abort-promise requires a value"))?
                    .to_string();
            }
            "--tasks" | "-t" => tasks_mode = true,
            "--task-promise" => {
                i += 1;
                task_promise = args
                    .get(i)
                    .ok_or_else(|| anyhow::anyhow!("Error: --task-promise requires a value"))?
                    .to_string();
            }
            "--rotation" => {
                i += 1;
                let value = args
                    .get(i)
                    .ok_or_else(|| anyhow::anyhow!("Error: --rotation requires a value"))?;
                rotation = parse_rotation(value)?;
            }
            "--model" => {
                i += 1;
                model = args
                    .get(i)
                    .ok_or_else(|| anyhow::anyhow!("Error: --model requires a value"))?
                    .to_string();
            }
            "--prompt-file" | "--file" | "-f" => {
                i += 1;
                prompt_file = args
                    .get(i)
                    .ok_or_else(|| anyhow::anyhow!("Error: --prompt-file requires a file path"))?
                    .to_string();
            }
            "--prompt-template" => {
                i += 1;
                prompt_template = args
                    .get(i)
                    .ok_or_else(|| {
                        anyhow::anyhow!("Error: --prompt-template requires a file path")
                    })?
                    .to_string();
            }
            "--no-stream" => stream_output = false,
            "--stream" => stream_output = true,
            "--verbose-tools" => verbose_tools = true,
            "--no-commit" => auto_commit = false,
            "--no-plugins" => disable_plugins = true,
            "--allow-all" => allow_all_permissions = true,
            "--no-allow-all" => allow_all_permissions = false,
            unknown if unknown.starts_with('-') => {
                bail!(
                    "Error: Unknown option: {}\nRun 'opennexus ralph --help' for available options",
                    unknown
                );
            }
            value => prompt_parts.push(value.to_string()),
        }
        i += 1;
    }

    if max_iterations > 0 && min_iterations > max_iterations {
        bail!(
            "Error: --min-iterations ({}) cannot be greater than --max-iterations ({})",
            min_iterations,
            max_iterations
        );
    }

    let (prompt, prompt_source) = if !prompt_file.is_empty() {
        (read_prompt_file(&prompt_file)?, prompt_file.clone())
    } else if prompt_parts.len() == 1 && Path::new(&prompt_parts[0]).exists() {
        (read_prompt_file(&prompt_parts[0])?, prompt_parts[0].clone())
    } else {
        (prompt_parts.join(" "), String::new())
    };

    Ok(ParsedRunOptions {
        prompt,
        prompt_source,
        min_iterations,
        max_iterations,
        completion_promise,
        abort_promise,
        tasks_mode,
        task_promise,
        model,
        agent,
        rotation,
        prompt_template,
        stream_output,
        verbose_tools,
        auto_commit,
        disable_plugins,
        allow_all_permissions,
        extra_agent_flags,
    })
}

fn parse_rotation(raw: &str) -> Result<Vec<RotationEntry>> {
    let mut entries = Vec::new();
    for part in raw
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let mut chunks = part.splitn(2, ':');
        let agent_raw = chunks.next().unwrap_or("");
        let model = chunks.next().unwrap_or("");
        if agent_raw.is_empty() || model.trim().is_empty() {
            bail!(
                "Error: Invalid rotation entry '{}'. Expected format: agent:model",
                part
            );
        }
        let agent = AgentType::from_str(agent_raw).ok_or_else(|| {
            anyhow::anyhow!(
                "Error: Invalid agent '{}' in rotation entry '{}'. Valid agents: opencode, claude-code, codex, copilot",
                agent_raw,
                part
            )
        })?;
        entries.push(RotationEntry {
            agent,
            model: model.trim().to_string(),
        });
    }
    if entries.is_empty() {
        bail!("Error: --rotation requires at least one agent:model entry");
    }
    Ok(entries)
}

fn read_prompt_file(path: &str) -> Result<String> {
    let file = Path::new(path);
    if !file.exists() {
        bail!("Error: Prompt file not found: {}", path);
    }
    if !file.is_file() {
        bail!("Error: Prompt path is not a file: {}", path);
    }
    let content = fs::read_to_string(file)
        .map_err(|_| anyhow::anyhow!("Error: Unable to read prompt file: {}", path))?;
    if content.trim().is_empty() {
        bail!("Error: Prompt file is empty: {}", path);
    }
    Ok(content)
}

fn option_value<'a>(args: &'a [String], key: &str) -> Option<&'a str> {
    let index = args.iter().position(|arg| arg == key)?;
    args.get(index + 1).map(|value| value.as_str())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_aliases_for_prompt_file_and_tasks() {
        let args = vec!["-f".to_string(), "Cargo.toml".to_string(), "-t".to_string()];
        let op = parse_operation(&args).expect("parse should succeed");
        let RalphOperation::Run(options) = op else {
            panic!("expected run operation");
        };
        assert!(options.tasks_mode);
        assert_eq!(options.prompt_source, "Cargo.toml");
    }

    #[test]
    fn parses_double_dash_extra_agent_flags() {
        let args = vec![
            "build feature".to_string(),
            "--".to_string(),
            "--extra".to_string(),
            "value".to_string(),
        ];
        let op = parse_operation(&args).expect("parse should succeed");
        let RalphOperation::Run(options) = op else {
            panic!("expected run operation");
        };
        assert_eq!(options.extra_agent_flags, vec!["--extra", "value"]);
    }

    #[test]
    fn rejects_invalid_rotation_shape() {
        let args = vec![
            "task".to_string(),
            "--rotation".to_string(),
            "opencode".to_string(),
        ];
        let err = parse_operation(&args).expect_err("parse should fail");
        assert!(err.to_string().contains("Invalid rotation entry"));
    }
}
