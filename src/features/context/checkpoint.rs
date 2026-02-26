use anyhow::{Context, Result};
use std::fs;
use std::path::Path;

use super::workflow_state::WorkflowCheckpoint;

pub(crate) fn save_checkpoint(path: &Path, checkpoint: &WorkflowCheckpoint) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).with_context(|| {
            format!(
                "Unable to create orchestration checkpoint directory '{}'.",
                parent.display()
            )
        })?;
    }
    let json = serde_json::to_string_pretty(checkpoint)
        .context("Unable to serialize orchestration checkpoint to JSON.")?;
    fs::write(path, json).with_context(|| {
        format!(
            "Unable to write orchestration checkpoint file '{}'.",
            path.display()
        )
    })?;
    Ok(())
}

pub(crate) fn load_checkpoint(path: &Path) -> Result<WorkflowCheckpoint> {
    let content = fs::read_to_string(path).with_context(|| {
        format!(
            "Unable to read orchestration checkpoint file '{}'.",
            path.display()
        )
    })?;
    let checkpoint: WorkflowCheckpoint = serde_json::from_str(&content)
        .with_context(|| format!("Invalid checkpoint JSON in '{}'.", path.display()))?;
    Ok(checkpoint)
}
