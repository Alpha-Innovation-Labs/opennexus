use std::collections::BTreeSet;
use std::process::Command;

pub fn snapshot_files() -> BTreeSet<String> {
    let mut files = BTreeSet::new();
    let tracked = Command::new("git").args(["ls-files"]).output();
    if let Ok(output) = tracked {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines().map(str::trim).filter(|line| !line.is_empty()) {
                files.insert(line.to_string());
            }
        }
    }

    let changed = Command::new("git").args(["status", "--porcelain"]).output();
    if let Ok(output) = changed {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                if line.len() > 3 {
                    files.insert(line[3..].trim().to_string());
                }
            }
        }
    }
    files
}

pub fn modified_since(before: &BTreeSet<String>, after: &BTreeSet<String>) -> Vec<String> {
    let mut changed = Vec::new();
    for item in before.union(after) {
        if before.contains(item) != after.contains(item) {
            changed.push(item.to_string());
        }
    }
    changed.sort();
    changed
}

pub fn auto_commit(iteration: usize) {
    let status = Command::new("git").args(["status", "--porcelain"]).output();
    let Ok(output) = status else {
        return;
    };
    if !output.status.success() || output.stdout.is_empty() {
        return;
    }

    let _ = Command::new("git").args(["add", "-A"]).status();
    let _ = Command::new("git")
        .args([
            "commit",
            "-m",
            &format!("Ralph iteration {}: work in progress", iteration),
        ])
        .status();
}
