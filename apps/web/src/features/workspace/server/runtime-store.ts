import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

import type { LiveEvent, LiveSessionSnapshot } from "@/entities/workspace/types";
import { logger } from "@/features/workspace/server/logger";

type ExecutionRecord = {
  executionId: string;
  contextId: string;
  contextFile: string;
  testId: string;
  provider: string;
  startedAt: number;
  active: boolean;
  events: LiveEvent[];
};

const runningByRow = new Map<string, ExecutionRecord>();

function rowKey(contextFile: string, testId: string): string {
  return `${contextFile}::${testId}`;
}

function appendEvent(record: ExecutionRecord, level: LiveEvent["level"], message: string): void {
  record.events.push({
    id: randomUUID(),
    timestamp: Date.now(),
    level,
    message,
  });

  if (record.events.length > 200) {
    record.events.splice(0, record.events.length - 200);
  }
}

export function startExecution(input: {
  contextId: string;
  contextFile: string;
  testId: string;
}): { ok: true; executionId: string } | { ok: false; error: string } {
  const key = rowKey(input.contextFile, input.testId);
  if (runningByRow.get(key)?.active) {
    return {
      ok: false,
      error:
        "This row is already running. Wait for completion or inspect the live session panel for progress.",
    };
  }

  const execution: ExecutionRecord = {
    executionId: randomUUID(),
    contextId: input.contextId,
    contextFile: input.contextFile,
    testId: input.testId,
    provider: "opennexus-cli",
    startedAt: Date.now(),
    active: true,
    events: [],
  };

  runningByRow.set(key, execution);
  appendEvent(
    execution,
    "info",
    `Queued execution for test '${input.testId}' from context '${input.contextId}'.`,
  );

  const command = "opennexus";
  const args = ["context", "implement", "--context-file", input.contextFile];
  const child = spawn(command, args, {
    env: {
      ...process.env,
      CDD_SELECTED_TEST: input.testId,
    },
  });

  appendEvent(
    execution,
    "info",
    `Started backend command: ${command} ${args.join(" ")}`,
  );

  child.stdout.on("data", (chunk: Buffer | string) => {
    const lines = chunk.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      appendEvent(execution, "info", line);
    }
  });

  child.stderr.on("data", (chunk: Buffer | string) => {
    const lines = chunk.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      appendEvent(execution, "warn", line);
    }
  });

  child.on("error", (error) => {
    appendEvent(
      execution,
      "error",
      `Failed to start backend command. Ensure 'opennexus' is installed and available in PATH. Error: ${error.message}`,
    );
    execution.active = false;
    logger.error({ error, contextFile: input.contextFile, testId: input.testId }, "Execution spawn failed");
  });

  child.on("close", (code) => {
    execution.active = false;
    if (code === 0) {
      appendEvent(execution, "info", "Execution finished successfully.");
    } else {
      appendEvent(
        execution,
        "error",
        `Execution ended with exit code ${code ?? -1}. Check backend logs or rerun with terminal visibility.`,
      );
    }
    logger.info({ code, contextFile: input.contextFile, testId: input.testId }, "Execution finished");
  });

  return { ok: true, executionId: execution.executionId };
}

export function getLiveSession(contextFile: string, testId: string): LiveSessionSnapshot {
  const key = rowKey(contextFile, testId);
  const record = runningByRow.get(key);

  if (!record) {
    return {
      active: false,
      provider: "none",
      sessionId: "none",
      events: [],
      hint: "No active execution for this row. Start execution to stream live events.",
    };
  }

  return {
    active: record.active,
    provider: record.provider,
    sessionId: record.executionId,
    events: record.events,
    hint: record.active
      ? "Streaming command output while execution is running."
      : "Execution finished. Streaming has stopped for this row.",
  };
}
