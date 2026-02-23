use anyhow::Result;
use serde_json::{json, Value};
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use crate::services::ralph_fs::RalphPaths;

pub fn ensure_ralph_opencode_config(
    paths: &RalphPaths,
    filter_plugins: bool,
    allow_all_permissions: bool,
) -> Result<PathBuf> {
    fs::create_dir_all(&paths.state_dir)?;
    let target = paths.state_dir.join("ralph-opencode.config.json");

    let mut root = serde_json::Map::new();
    root.insert(
        "$schema".to_string(),
        json!("https://opencode.ai/config.json"),
    );

    if filter_plugins {
        let plugins = load_plugins();
        root.insert(
            "plugin".to_string(),
            Value::Array(plugins.into_iter().map(Value::String).collect()),
        );
    }

    if allow_all_permissions {
        root.insert(
            "permission".to_string(),
            json!({
                "read": "allow",
                "edit": "allow",
                "glob": "allow",
                "grep": "allow",
                "list": "allow",
                "bash": "allow",
                "task": "allow",
                "webfetch": "allow",
                "websearch": "allow",
                "codesearch": "allow",
                "todowrite": "allow",
                "todoread": "allow",
                "question": "allow",
                "lsp": "allow",
                "external_directory": "allow"
            }),
        );
    }

    let serialized = serde_json::to_string_pretty(&Value::Object(root))?;
    fs::write(&target, format!("{}\n", serialized))?;
    Ok(target)
}

fn load_plugins() -> Vec<String> {
    let mut plugins = BTreeSet::<String>::new();
    for path in candidate_configs() {
        if let Ok(content) = fs::read_to_string(path) {
            let sanitized = strip_json_comments(&content);
            if let Ok(value) = serde_json::from_str::<Value>(&sanitized) {
                if let Some(list) = value.get("plugin").and_then(Value::as_array) {
                    for item in list {
                        if let Some(name) = item.as_str() {
                            if name.to_ascii_lowercase().contains("auth") {
                                plugins.insert(name.to_string());
                            }
                        }
                    }
                }
            }
        }
    }
    plugins.into_iter().collect()
}

fn candidate_configs() -> Vec<PathBuf> {
    let mut files = Vec::new();
    if let Some(home) = std::env::var_os("HOME") {
        files.push(Path::new(&home).join(".config/opencode/opencode.json"));
    }
    files.push(Path::new(".ralph/opencode.json").to_path_buf());
    files.push(Path::new(".opencode/opencode.json").to_path_buf());
    files
}

fn strip_json_comments(content: &str) -> String {
    let block = regex::Regex::new(r"/\*[\s\S]*?\*/").expect("block regex");
    let line = regex::Regex::new(r"(?m)^\s*//.*$").expect("line regex");
    let no_block = block.replace_all(content, "");
    line.replace_all(&no_block, "").to_string()
}
