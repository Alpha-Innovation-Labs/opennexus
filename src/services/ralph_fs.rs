use anyhow::Result;
use std::fs;
use std::path::PathBuf;

use crate::core::ralph::model::{RalphHistory, RalphState};

#[derive(Debug, Clone)]
pub struct RalphPaths {
    pub state_dir: PathBuf,
    pub state_file: PathBuf,
    pub context_file: PathBuf,
    pub history_file: PathBuf,
    pub tasks_file: PathBuf,
}

impl RalphPaths {
    pub fn in_cwd() -> Self {
        let state_dir = PathBuf::from(".ralph");
        Self {
            state_file: state_dir.join("ralph-loop.state.json"),
            context_file: state_dir.join("ralph-context.md"),
            history_file: state_dir.join("ralph-history.json"),
            tasks_file: state_dir.join("ralph-tasks.md"),
            state_dir,
        }
    }
}

pub fn load_state(paths: &RalphPaths) -> Option<RalphState> {
    let text = fs::read_to_string(&paths.state_file).ok()?;
    serde_json::from_str::<RalphState>(&text).ok()
}

pub fn save_state(paths: &RalphPaths, state: &RalphState) -> Result<()> {
    fs::create_dir_all(&paths.state_dir)?;
    fs::write(
        &paths.state_file,
        format!("{}\n", serde_json::to_string_pretty(state)?),
    )?;
    Ok(())
}

pub fn clear_state(paths: &RalphPaths) {
    let _ = fs::remove_file(&paths.state_file);
}

pub fn load_history(paths: &RalphPaths) -> RalphHistory {
    fs::read_to_string(&paths.history_file)
        .ok()
        .and_then(|text| serde_json::from_str::<RalphHistory>(&text).ok())
        .unwrap_or_default()
}

pub fn save_history(paths: &RalphPaths, history: &RalphHistory) -> Result<()> {
    fs::create_dir_all(&paths.state_dir)?;
    fs::write(
        &paths.history_file,
        format!("{}\n", serde_json::to_string_pretty(history)?),
    )?;
    Ok(())
}

pub fn clear_history(paths: &RalphPaths) {
    let _ = fs::remove_file(&paths.history_file);
}

pub fn load_context(paths: &RalphPaths) -> Option<String> {
    let text = fs::read_to_string(&paths.context_file).ok()?;
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(trimmed.to_string())
}

pub fn clear_context(paths: &RalphPaths) {
    let _ = fs::remove_file(&paths.context_file);
}

pub fn append_context(paths: &RalphPaths, text: &str) -> Result<()> {
    fs::create_dir_all(&paths.state_dir)?;
    let timestamp = chrono_like_now();
    let entry = format!("\n## Context added at {}\n{}\n", timestamp, text);
    if paths.context_file.exists() {
        let current = fs::read_to_string(&paths.context_file).unwrap_or_default();
        fs::write(&paths.context_file, format!("{}{}", current, entry))?;
    } else {
        fs::write(
            &paths.context_file,
            format!("# Ralph Loop Context\n{}", entry),
        )?;
    }
    Ok(())
}

fn chrono_like_now() -> String {
    let now = std::time::SystemTime::now();
    let secs = now
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{}", secs)
}
