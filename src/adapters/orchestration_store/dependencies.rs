use anyhow::{bail, Context, Result};
use rusqlite::params;
use std::collections::BTreeSet;

use super::OrchestrationStore;

impl OrchestrationStore {
    pub fn latest_success_for_context_id(&self, context_id: &str) -> Result<Option<i64>> {
        let mut stmt = self
            .connection
            .prepare(
                "SELECT id FROM orchestration_runs
                 WHERE context_id=?1 AND status='success'
                 ORDER BY id DESC LIMIT 1",
            )
            .context("Failed preparing dependency gate lookup query.")?;
        let mut rows = stmt.query(params![context_id]).with_context(|| {
            format!(
                "Failed querying latest successful run for context_id='{}'.",
                context_id
            )
        })?;
        if let Some(row) = rows.next()? {
            return Ok(Some(row.get(0)?));
        }
        Ok(None)
    }

    pub fn latest_success_for_project(&self, project: &str) -> Result<Option<i64>> {
        let normalized = project.trim().to_ascii_lowercase();
        if normalized.is_empty() {
            bail!(
                "Project dependency reference cannot be empty. Use depends_on.projects entries like 'nexus-cli'."
            );
        }

        let mut stmt = self
            .connection
            .prepare(
                "SELECT id, context_file FROM orchestration_runs
                 WHERE status='success' ORDER BY id DESC",
            )
            .context("Failed preparing project-level dependency lookup query.")?;
        let rows = stmt.query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?;
        for (run_id, context_file) in rows.filter_map(Result::ok) {
            if infer_project_from_context_path(&context_file)
                .map(|value| value == normalized)
                .unwrap_or(false)
            {
                return Ok(Some(run_id));
            }
        }
        Ok(None)
    }

    pub fn resolve_project_reference(&self, reference: &str) -> Result<String> {
        let normalized = reference.trim().to_ascii_lowercase();
        if normalized.is_empty() {
            bail!(
                "Project dependency reference cannot be empty. Use depends_on.projects entries like 'nexus-cli'."
            );
        }

        let known_projects = self.known_projects_from_runs()?;
        if known_projects.is_empty() {
            bail!(
                "Unable to resolve project dependency '{}': orchestration history has no recognizable project paths. Run at least one context under '.nexus/context/<project>/...'.",
                reference
            );
        }

        if known_projects.contains(&normalized) {
            return Ok(normalized);
        }

        let candidates = known_projects
            .iter()
            .filter(|project| {
                project.starts_with(&normalized)
                    || project.contains(&normalized)
                    || normalized.starts_with(project.as_str())
            })
            .cloned()
            .collect::<Vec<String>>();

        if candidates.len() == 1 {
            return Ok(candidates[0].clone());
        }

        if candidates.is_empty() {
            let known = known_projects.iter().cloned().collect::<Vec<String>>();
            bail!(
                "Unknown project dependency '{}'. Known projects from orchestration history: {}. Use an exact project name in depends_on.projects.",
                reference,
                known.join(", ")
            );
        }

        bail!(
            "Ambiguous project dependency '{}': matched [{}]. Use an exact project name in depends_on.projects.",
            reference,
            candidates.join(", ")
        );
    }

    fn known_projects_from_runs(&self) -> Result<BTreeSet<String>> {
        let mut stmt = self
            .connection
            .prepare("SELECT context_file FROM orchestration_runs")
            .context("Failed preparing known-project discovery query.")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(0))?;
        let mut projects = BTreeSet::<String>::new();
        for context_file in rows.filter_map(Result::ok) {
            if let Some(project) = infer_project_from_context_path(&context_file) {
                projects.insert(project);
            }
        }
        Ok(projects)
    }
}

fn infer_project_from_context_path(context_file: &str) -> Option<String> {
    let normalized = context_file.replace('\\', "/");
    let marker = "/context/";
    let marker_index = normalized.find(marker)?;
    let after = &normalized[(marker_index + marker.len())..];
    let project = after.split('/').next()?.trim().to_ascii_lowercase();
    if project.is_empty() {
        None
    } else {
        Some(project)
    }
}
