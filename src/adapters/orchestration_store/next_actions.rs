use anyhow::{bail, Context, Result};
use rusqlite::{params, Connection};
use std::collections::{BTreeMap, BTreeSet};

use super::connection::now_epoch;
use super::{ContextNextAction, NextActionReconciliationSummary, OrchestrationStore};

impl OrchestrationStore {
    pub fn reconcile_next_actions(
        &self,
        run_id: i64,
        context_id: &str,
        next_actions: &[ContextNextAction],
    ) -> Result<NextActionReconciliationSummary> {
        self.in_transaction("next action reconciliation", |conn| {
            reconcile_next_actions_tx(conn, run_id, context_id, next_actions)
        })
    }
}

fn normalize_action_key(action: &ContextNextAction) -> String {
    let description = action
        .description
        .split_whitespace()
        .collect::<Vec<&str>>()
        .join(" ")
        .to_ascii_lowercase();
    format!("{}::{}", action.test_id.to_ascii_lowercase(), description)
}

fn normalize_action_payload(action: &ContextNextAction) -> String {
    serde_json::json!({
        "test_id": action.test_id.trim().to_ascii_lowercase(),
        "description": action
            .description
            .split_whitespace()
            .collect::<Vec<&str>>()
            .join(" "),
    })
    .to_string()
}

pub(super) fn reconcile_next_actions_tx(
    conn: &Connection,
    run_id: i64,
    context_id: &str,
    next_actions: &[ContextNextAction],
) -> Result<NextActionReconciliationSummary> {
    let mut current = BTreeMap::<String, (String, String, String)>::new();
    for action in next_actions {
        let key = normalize_action_key(action);
        if current.contains_key(&key) {
            bail!(
                "Reconciliation mapping error: context_id '{}' has duplicate normalized next action key '{}'.",
                context_id,
                key
            );
        }
        let payload = normalize_action_payload(action);
        current.insert(
            key,
            (action.test_id.clone(), action.description.clone(), payload),
        );
    }

    let previous_run_id = {
        let mut stmt = conn.prepare(
            "SELECT id FROM orchestration_runs
             WHERE context_id=?1 AND status='success'
             ORDER BY id DESC LIMIT 1",
        )?;
        let mut rows = stmt.query(params![context_id])?;
        if let Some(row) = rows.next()? {
            Some(row.get::<_, i64>(0)?)
        } else {
            None
        }
    };

    let mut previous_keys = BTreeSet::<String>::new();
    if let Some(prev_run_id) = previous_run_id {
        let mut stmt = conn.prepare(
            "SELECT action_key FROM orchestration_next_action_snapshots
             WHERE run_id=?1 ORDER BY id ASC",
        )?;
        let rows = stmt.query_map(params![prev_run_id], |row| row.get(0))?;
        previous_keys.extend(rows.filter_map(Result::ok));
    }

    let current_keys = current.keys().cloned().collect::<BTreeSet<String>>();
    let added = current_keys
        .difference(&previous_keys)
        .cloned()
        .collect::<Vec<String>>();
    let removed = previous_keys
        .difference(&current_keys)
        .cloned()
        .collect::<Vec<String>>();
    let retained = current_keys
        .intersection(&previous_keys)
        .cloned()
        .collect::<Vec<String>>();

    for (key, (test_id, description, payload)) in &current {
        conn.execute(
            "INSERT INTO orchestration_next_action_snapshots (
                run_id, context_id, action_key, test_id, description, normalized_payload, created_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![
                run_id,
                context_id,
                key,
                test_id,
                description,
                payload,
                now_epoch()
            ],
        )
        .with_context(|| {
            format!(
                "Failed to persist normalized next action snapshot '{}' for run {}.",
                key, run_id
            )
        })?;
    }

    for key in &added {
        conn.execute(
            "INSERT INTO orchestration_next_action_lifecycle (
                run_id, context_id, action_key, lifecycle_state, reason, created_at
             ) VALUES (?1, ?2, ?3, 'pending', 'newly added action compared to last successful snapshot', ?4)",
            params![run_id, context_id, key, now_epoch()],
        )?;
    }
    for key in &removed {
        conn.execute(
            "INSERT INTO orchestration_next_action_lifecycle (
                run_id, context_id, action_key, lifecycle_state, reason, created_at
             ) VALUES (?1, ?2, ?3, 'cancelled', 'action removed from current context snapshot', ?4)",
            params![run_id, context_id, key, now_epoch()],
        )?;
    }
    for key in &retained {
        conn.execute(
            "INSERT INTO orchestration_next_action_lifecycle (
                run_id, context_id, action_key, lifecycle_state, reason, created_at
             ) VALUES (?1, ?2, ?3, 'active', 'action retained from last successful snapshot', ?4)",
            params![run_id, context_id, key, now_epoch()],
        )?;
    }

    Ok(NextActionReconciliationSummary {
        added_pending: added.len(),
        removed_cancelled: removed.len(),
        retained_active: retained.len(),
    })
}
