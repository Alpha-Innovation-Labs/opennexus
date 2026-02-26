import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import {
  buildStatusArgs,
  createNadStatusAdapter,
  type NadStatusAdapterError,
} from "@/features/orchestration-status/server/nad-orchestration-status-adapter";

interface FakeResponse {
  stdout: string;
  stderr: string;
  exitStatus: number | null;
  durationMs: number;
  timedOut: boolean;
}

function contextPath(): string {
  return ".nexus/context/nexus-adapter/cli-bridge/NAD_003-adapter-status-and-run-history-query-mapping.md";
}

test("builds status command args for orchestration CLI", () => {
  const args = buildStatusArgs("/repo/.nexus/context/demo/CTX_001.md");
  assert.deepEqual(args, [
    "orchestration",
    "status",
    "--context-file",
    "/repo/.nexus/context/demo/CTX_001.md",
    "--format",
    "json",
  ]);
});

test("returns typed status payload and command metadata", async () => {
  const calls: Array<{ binary: string; args: string[]; timeoutMs: number }> = [];
  const adapter = createNadStatusAdapter({
    timeoutMs: 3456,
    executor: {
      async run(binary, args, timeoutMs): Promise<FakeResponse> {
        calls.push({ binary, args, timeoutMs });
        return {
          stdout: JSON.stringify({
            context_file: args[3],
            pipeline_name: "default",
            run_id: 42,
            status: "running",
            terminal_reason: null,
            started_at: 100,
            ended_at: null,
            message: "Pipeline currently active.",
            remediation: null,
            active_run_ids: [42],
          }),
          stderr: "",
          exitStatus: 0,
          durationMs: 17,
          timedOut: false,
        };
      },
    },
  });

  const previousRoot = process.env.NEXUS_REPO_ROOT;
  process.env.NEXUS_REPO_ROOT = path.resolve(process.cwd(), "../..");

  const result = await adapter.status(contextPath());
  assert.equal(result.payload.status, "running");
  assert.equal(result.payload.pipelineName, "default");
  assert.equal(result.payload.runId, 42);
  assert.equal(result.command.commandName, "orchestration.status");
  assert.equal(result.command.durationMs, 17);
  assert.equal(calls[0]?.timeoutMs, 3456);
  assert.equal(calls[0]?.args[1], "status");
  assert.equal(calls[0]?.args[5], "json");

  process.env.NEXUS_REPO_ROOT = previousRoot;
});

test("normalizes timeout failures into command_timeout category", async () => {
  const adapter = createNadStatusAdapter({
    executor: {
      async run(): Promise<FakeResponse> {
        return {
          stdout: "",
          stderr: "",
          exitStatus: 124,
          durationMs: 8001,
          timedOut: true,
        };
      },
    },
  });

  const previousRoot = process.env.NEXUS_REPO_ROOT;
  process.env.NEXUS_REPO_ROOT = path.resolve(process.cwd(), "../..");

  await assert.rejects(async () => adapter.status(contextPath()), (error: unknown) => {
    const normalized = error as NadStatusAdapterError;
    assert.equal(normalized.category, "command_timeout");
    return true;
  });

  process.env.NEXUS_REPO_ROOT = previousRoot;
});

test("normalizes contract violations when required fields are missing", async () => {
  const adapter = createNadStatusAdapter({
    executor: {
      async run(): Promise<FakeResponse> {
        return {
          stdout: JSON.stringify({
            context_file: ".nexus/context/demo/CTX_001.md",
            message: "missing status",
          }),
          stderr: "",
          exitStatus: 0,
          durationMs: 12,
          timedOut: false,
        };
      },
    },
  });

  const previousRoot = process.env.NEXUS_REPO_ROOT;
  process.env.NEXUS_REPO_ROOT = path.resolve(process.cwd(), "../..");

  await assert.rejects(async () => adapter.status(contextPath()), (error: unknown) => {
    const normalized = error as NadStatusAdapterError;
    assert.equal(normalized.category, "contract_missing_fields");
    assert.match(normalized.message, /missing required fields/i);
    return true;
  });

  process.env.NEXUS_REPO_ROOT = previousRoot;
});

test("rejects status queries for invalid context target", async () => {
  const adapter = createNadStatusAdapter({
    executor: {
      async run(): Promise<FakeResponse> {
        throw new Error("should not execute command for invalid context target");
      },
    },
  });

  const previousRoot = process.env.NEXUS_REPO_ROOT;
  process.env.NEXUS_REPO_ROOT = path.resolve(process.cwd(), "../..");

  await assert.rejects(async () => adapter.status("README.md"), (error: unknown) => {
    const normalized = error as NadStatusAdapterError;
    assert.equal(normalized.category, "invalid_context_target");
    return true;
  });

  process.env.NEXUS_REPO_ROOT = previousRoot;
});
