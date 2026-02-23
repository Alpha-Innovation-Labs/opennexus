use std::collections::HashMap;
use std::env;

use crate::core::ralph::model::AgentType;
use crate::utils::text::strip_ansi;

#[derive(Debug, Clone)]
pub struct AgentInvocation {
    pub command: String,
    pub args: Vec<String>,
    pub env: HashMap<String, String>,
}

pub fn agent_label(agent: AgentType) -> &'static str {
    match agent {
        AgentType::Opencode => "OpenCode",
        AgentType::ClaudeCode => "Claude Code",
        AgentType::Codex => "Codex",
        AgentType::Copilot => "Copilot CLI",
    }
}

pub fn resolve_command(agent: AgentType) -> String {
    match agent {
        AgentType::Opencode => {
            env::var("RALPH_OPENCODE_BINARY").unwrap_or_else(|_| "opencode".to_string())
        }
        AgentType::ClaudeCode => {
            env::var("RALPH_CLAUDE_BINARY").unwrap_or_else(|_| "claude".to_string())
        }
        AgentType::Codex => env::var("RALPH_CODEX_BINARY").unwrap_or_else(|_| "codex".to_string()),
        AgentType::Copilot => {
            env::var("RALPH_COPILOT_BINARY").unwrap_or_else(|_| "copilot".to_string())
        }
    }
}

pub fn build_invocation(
    agent: AgentType,
    prompt: &str,
    model: &str,
    allow_all_permissions: bool,
    extra_flags: &[String],
    stream_output: bool,
    opencode_config: Option<String>,
) -> AgentInvocation {
    let mut args = Vec::new();
    let mut env_map: HashMap<String, String> = env::vars().collect();

    match agent {
        AgentType::Opencode => {
            args.push("run".to_string());
            if !model.is_empty() {
                args.push("-m".to_string());
                args.push(model.to_string());
            }
            args.extend(extra_flags.iter().cloned());
            args.push(prompt.to_string());
            if let Some(path) = opencode_config {
                env_map.insert("OPENCODE_CONFIG".to_string(), path);
            }
        }
        AgentType::ClaudeCode => {
            args.push("-p".to_string());
            args.push(prompt.to_string());
            if stream_output {
                args.push("--output-format".to_string());
                args.push("stream-json".to_string());
                args.push("--include-partial-messages".to_string());
            }
            if !model.is_empty() {
                args.push("--model".to_string());
                args.push(model.to_string());
            }
            if allow_all_permissions {
                args.push("--dangerously-skip-permissions".to_string());
            }
            args.extend(extra_flags.iter().cloned());
        }
        AgentType::Codex => {
            args.push("exec".to_string());
            if !model.is_empty() {
                args.push("--model".to_string());
                args.push(model.to_string());
            }
            if allow_all_permissions {
                args.push("--full-auto".to_string());
            }
            args.extend(extra_flags.iter().cloned());
            args.push(prompt.to_string());
        }
        AgentType::Copilot => {
            args.push("-p".to_string());
            args.push(prompt.to_string());
            if !model.is_empty() {
                args.push("--model".to_string());
                args.push(model.to_string());
            }
            if allow_all_permissions {
                args.push("--allow-all".to_string());
                args.push("--no-ask-user".to_string());
            }
            args.extend(extra_flags.iter().cloned());
        }
    }

    AgentInvocation {
        command: resolve_command(agent),
        args,
        env: env_map,
    }
}

pub fn parse_tool_name(agent: AgentType, line: &str) -> Option<String> {
    let clean = strip_ansi(line);
    match agent {
        AgentType::Opencode => regex::Regex::new(r"^\|\s{2}([A-Za-z0-9_-]+)")
            .ok()?
            .captures(&clean)
            .and_then(|cap| cap.get(1).map(|m| m.as_str().to_string())),
        AgentType::ClaudeCode => {
            let upper = clean.to_ascii_lowercase();
            if upper.contains("\"type\":\"tool_use\"") || upper.contains("\"type\": \"tool_use\"") {
                let re = regex::Regex::new(r#"\"name\"\s*:\s*\"([^\"]+)\""#).ok()?;
                if let Some(cap) = re.captures(&clean) {
                    return cap.get(1).map(|m| m.as_str().to_string());
                }
            }
            let re = regex::Regex::new(r"(?i)(Using|Called|Tool:)\s+([A-Za-z0-9_.-]+)").ok()?;
            re.captures(&clean)
                .and_then(|cap| cap.get(2).map(|m| m.as_str().to_string()))
        }
        AgentType::Codex | AgentType::Copilot => {
            let re =
                regex::Regex::new(r"(?i)(Tool:|Using|Calling|Running)\s+([A-Za-z0-9_.-]+)").ok()?;
            re.captures(&clean)
                .and_then(|cap| cap.get(2).map(|m| m.as_str().to_string()))
        }
    }
}
