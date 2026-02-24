import path from "node:path";
import fs from "node:fs";

import Database from "better-sqlite3";

import type { TaskStatusSnapshot } from "@/entities/workspace/types";
import { env } from "@/config/env";

type TaskRow = {
  run_id: number;
  started_at: number;
  status: string;
  details: string | null;
};

function resolveDbPath(): string {
  const workspaceRoot = path.resolve(process.cwd(), "../..");
  return path.resolve(workspaceRoot, env.cddDbPath);
}

export function readTaskStatus(contextId: string, testId: string): TaskStatusSnapshot {
  const dbPath = resolveDbPath();

  if (!fs.existsSync(dbPath)) {
    return {
      status: "unknown",
      runId: null,
      timestamp: null,
      details: `SQLite database not found at '${dbPath}'. Run a CDD command to initialize observability storage.`,
    };
  }

  let db: InstanceType<typeof Database> | null = null;

  try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
    const row = db
      .prepare(
        `
        SELECT
          r.id AS run_id,
          r.started_at,
          t.status,
          t.details
        FROM cdd_tasks t
        JOIN cdd_runs r ON r.id = t.run_id
        WHERE r.context_id = ? AND t.test_id = ?
        ORDER BY r.id DESC
        LIMIT 1
      `,
      )
      .get(contextId, testId) as TaskRow | undefined;

    if (!row) {
      return {
        status: "unknown",
        runId: null,
        timestamp: null,
        details: null,
      };
    }

    const normalized =
      row.status === "implemented" || row.status === "failed" || row.status === "missing"
        ? row.status
        : "unknown";

    return {
      status: normalized,
      runId: row.run_id,
      timestamp: row.started_at,
      details: row.details,
    };
  } catch {
    return {
      status: "unknown",
      runId: null,
      timestamp: null,
      details:
        "Could not query SQLite status tables. Verify CDD_DB_PATH and that observability schema is initialized.",
    };
  } finally {
    db?.close();
  }
}
