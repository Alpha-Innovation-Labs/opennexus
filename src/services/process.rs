use anyhow::{Context, Result};
use std::collections::BTreeMap;
use std::io::{BufRead, BufReader};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

use crate::adapters::agents::parse_tool_name;
use crate::core::ralph::model::AgentType;
use crate::utils::text::format_duration_short;

#[derive(Debug, Clone)]
pub struct ProcessResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub tools: BTreeMap<String, usize>,
}

#[derive(Clone)]
pub struct ActiveChild {
    pub child: Arc<Mutex<Option<Child>>>,
}

impl ActiveChild {
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
        }
    }

    pub fn kill(&self) {
        if let Ok(mut guard) = self.child.lock() {
            if let Some(child) = guard.as_mut() {
                let _ = child.kill();
            }
        }
    }
}

pub fn run_command(
    command: &str,
    args: &[String],
    env: &std::collections::HashMap<String, String>,
    agent: AgentType,
    stream: bool,
    verbose_tools: bool,
    interrupted: Arc<AtomicBool>,
    active: ActiveChild,
) -> Result<ProcessResult> {
    let mut cmd = Command::new(command);
    cmd.args(args)
        .stdin(Stdio::inherit())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    for (key, value) in env {
        cmd.env(key, value);
    }

    let child = cmd
        .spawn()
        .with_context(|| format!("Failed to launch agent binary '{}'", command))?;

    if !stream {
        let output = child.wait_with_output()?;
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        let combined = format!("{}\n{}", stdout, stderr);
        if !stderr.is_empty() {
            eprint!("{}", stderr);
        }
        if !stdout.is_empty() {
            print!("{}", stdout);
        }
        return Ok(ProcessResult {
            stdout,
            stderr,
            exit_code: output.status.code().unwrap_or(-1),
            tools: collect_tools(agent, &combined),
        });
    }

    {
        if let Ok(mut guard) = active.child.lock() {
            *guard = Some(child);
        }
    }

    let stdout_text = Arc::new(Mutex::new(String::new()));
    let stderr_text = Arc::new(Mutex::new(String::new()));
    let tools = Arc::new(Mutex::new(BTreeMap::<String, usize>::new()));
    let last_activity = Arc::new(AtomicU64::new(now_ms()));

    let stdout_handle = {
        let stdout_text = Arc::clone(&stdout_text);
        let tools = Arc::clone(&tools);
        let last_activity = Arc::clone(&last_activity);
        let active = active.clone();
        thread::spawn(move || {
            if let Ok(mut guard) = active.child.lock() {
                if let Some(child) = guard.as_mut() {
                    if let Some(out) = child.stdout.take() {
                        let reader = BufReader::new(out);
                        for line in reader.lines().map_while(Result::ok) {
                            last_activity.store(now_ms(), Ordering::Relaxed);
                            let rendered_lines = if agent == AgentType::ClaudeCode {
                                extract_claude_display_lines(&line)
                            } else {
                                vec![line.clone()]
                            };
                            let parsed_tool = parse_tool_name(agent, &line);
                            if let Some(ref tool) = parsed_tool {
                                if let Ok(mut counts) = tools.lock() {
                                    *counts.entry(tool.to_string()).or_insert(0) += 1;
                                }
                            }
                            if parsed_tool.is_some() && !verbose_tools {
                                continue;
                            }
                            for rendered in rendered_lines {
                                println!("{}", rendered);
                                if let Ok(mut all) = stdout_text.lock() {
                                    all.push_str(&rendered);
                                    all.push('\n');
                                }
                            }
                        }
                    }
                }
            }
        })
    };

    let stderr_handle = {
        let stderr_text = Arc::clone(&stderr_text);
        let tools = Arc::clone(&tools);
        let last_activity = Arc::clone(&last_activity);
        let active = active.clone();
        thread::spawn(move || {
            if let Ok(mut guard) = active.child.lock() {
                if let Some(child) = guard.as_mut() {
                    if let Some(err) = child.stderr.take() {
                        let reader = BufReader::new(err);
                        for line in reader.lines().map_while(Result::ok) {
                            last_activity.store(now_ms(), Ordering::Relaxed);
                            let rendered_lines = if agent == AgentType::ClaudeCode {
                                extract_claude_display_lines(&line)
                            } else {
                                vec![line.clone()]
                            };
                            let parsed_tool = parse_tool_name(agent, &line);
                            if let Some(ref tool) = parsed_tool {
                                if let Ok(mut counts) = tools.lock() {
                                    *counts.entry(tool.to_string()).or_insert(0) += 1;
                                }
                            }
                            if parsed_tool.is_some() && !verbose_tools {
                                continue;
                            }
                            for rendered in rendered_lines {
                                eprintln!("{}", rendered);
                                if let Ok(mut all) = stderr_text.lock() {
                                    all.push_str(&rendered);
                                    all.push('\n');
                                }
                            }
                        }
                    }
                }
            }
        })
    };

    let beat_active = Arc::new(AtomicBool::new(true));
    let heartbeat = {
        let beat_active = Arc::clone(&beat_active);
        let last_activity = Arc::clone(&last_activity);
        thread::spawn(move || {
            let started = now_ms();
            while beat_active.load(Ordering::Relaxed) {
                thread::sleep(Duration::from_secs(10));
                let now = now_ms();
                let recent = last_activity.load(Ordering::Relaxed);
                if now.saturating_sub(recent) >= 10_000 {
                    println!(
                        "| Heartbeat working... elapsed {} · last activity {} ago",
                        format_duration_short((now - started) as u128),
                        format_duration_short((now - recent) as u128)
                    );
                }
            }
        })
    };

    loop {
        if interrupted.load(Ordering::Relaxed) {
            active.kill();
            break;
        }
        let done = if let Ok(mut guard) = active.child.lock() {
            if let Some(child) = guard.as_mut() {
                matches!(child.try_wait(), Ok(Some(_)))
            } else {
                true
            }
        } else {
            true
        };
        if done {
            break;
        }
        thread::sleep(Duration::from_millis(150));
    }

    let status = {
        let mut exit = -1;
        if let Ok(mut guard) = active.child.lock() {
            if let Some(mut child) = guard.take() {
                if let Ok(status) = child.wait() {
                    exit = status.code().unwrap_or(-1);
                }
            }
        }
        exit
    };

    let _ = stdout_handle.join();
    let _ = stderr_handle.join();
    beat_active.store(false, Ordering::Relaxed);
    let _ = heartbeat.join();

    let tool_counts = tools.lock().map(|v| v.clone()).unwrap_or_default();
    if !verbose_tools && !tool_counts.is_empty() {
        let mut entries: Vec<String> = tool_counts
            .iter()
            .map(|(name, count)| format!("{} {}", name, count))
            .collect();
        entries.sort();
        println!("| Tools {}", entries.join(" • "));
    }

    Ok(ProcessResult {
        stdout: stdout_text.lock().map(|v| v.clone()).unwrap_or_default(),
        stderr: stderr_text.lock().map(|v| v.clone()).unwrap_or_default(),
        exit_code: status,
        tools: tool_counts,
    })
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn collect_tools(agent: AgentType, output: &str) -> BTreeMap<String, usize> {
    let mut tools = BTreeMap::new();
    for line in output.lines() {
        if let Some(name) = parse_tool_name(agent, line) {
            *tools.entry(name).or_insert(0) += 1;
        }
    }
    tools
}

fn extract_claude_display_lines(raw_line: &str) -> Vec<String> {
    if !raw_line.trim_start().starts_with('{') {
        return vec![raw_line.to_string()];
    }
    let Ok(payload) = serde_json::from_str::<serde_json::Value>(raw_line) else {
        return vec![raw_line.to_string()];
    };

    let mut lines = Vec::<String>::new();
    let mut push_value = |value: &serde_json::Value| {
        if let Some(text) = value.as_str() {
            for segment in text
                .lines()
                .map(str::trim)
                .filter(|segment| !segment.is_empty())
            {
                lines.push(segment.to_string());
            }
        }
    };

    match payload.get("type").and_then(|value| value.as_str()) {
        Some("assistant") => {
            if let Some(message) = payload.get("message") {
                if let Some(content) = message.get("content") {
                    if let Some(content_text) = content.as_str() {
                        push_value(&serde_json::Value::String(content_text.to_string()));
                    }
                    if let Some(blocks) = content.as_array() {
                        for block in blocks {
                            if block.get("type").and_then(|value| value.as_str())
                                == Some("tool_use")
                            {
                                continue;
                            }
                            if let Some(text) = block.get("text") {
                                push_value(text);
                            }
                            if let Some(content) = block.get("content") {
                                push_value(content);
                            }
                            if let Some(thinking) = block.get("thinking") {
                                push_value(thinking);
                            }
                        }
                    }
                }
            }
            if let Some(delta) = payload.get("delta") {
                if let Some(text) = delta.get("text") {
                    push_value(text);
                }
                if let Some(content) = delta.get("content") {
                    push_value(content);
                }
                if let Some(thinking) = delta.get("thinking") {
                    push_value(thinking);
                }
            }
        }
        Some("result") => {
            if let Some(result) = payload.get("result") {
                push_value(result);
            }
        }
        Some("error") => {
            if let Some(error) = payload.get("error") {
                if error.is_object() {
                    if let Some(message) = error.get("message") {
                        push_value(message);
                    }
                } else {
                    push_value(error);
                }
            }
        }
        _ => {}
    }

    lines
}
