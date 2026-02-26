import { spawn } from "node:child_process";
import fsSync from "node:fs";
import path from "node:path";

import type {
  NadCommandMetadata,
  NadPipelineStatus,
  NadStatusAdapterError,
  NadStatusErrorCategory,
  NadStatusResult,
} from "@/features/orchestration-status/model/nad-orchestration-status-types";

const DEFAULT_BINARY = "opennexus";
const DEFAULT_TIMEOUT_MS = 8_000;

export interface NadStatusAdapter {
  status(contextFile: string): Promise<NadStatusResult>;
}

export type {
  NadCommandMetadata,
  NadPipelineStatus,
  NadStatusAdapterError,
  NadStatusErrorCategory,
  NadStatusResult,
};

interface CommandOutput {
  stdout: string;
  stderr: string;
  exitStatus: number | null;
  durationMs: number;
  timedOut: boolean;
}

interface CommandExecutor {
  run(binary: string, args: string[], timeoutMs: number): Promise<CommandOutput>;
}

interface AdapterOptions {
  binary?: string;
  timeoutMs?: number;
  executor?: CommandExecutor;
}

class ProcessCommandExecutor implements CommandExecutor {
  async run(binary: string, args: string[], timeoutMs: number): Promise<CommandOutput> {
    const startedAt = Date.now();
    return await new Promise<CommandOutput>((resolve, reject) => {
      const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        child.kill("SIGKILL");
      }, timeoutMs);

      child.stdout.on("data", (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });

      child.stderr.on("data", (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      child.on("error", (error) => {
        clearTimeout(timer);
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
          reject(new Error("binary_missing"));
          return;
        }
        reject(error);
      });

      child.on("close", (code) => {
        clearTimeout(timer);
        resolve({
          stdout,
          stderr,
          exitStatus: code,
          durationMs: Date.now() - startedAt,
          timedOut,
        });
      });
    });
  }
}

export function buildStatusArgs(contextFile: string): string[] {
  return ["orchestration", "status", "--context-file", contextFile, "--format", "json"];
}

function resolveRepoRoot(): string {
  if (process.env.NEXUS_REPO_ROOT) {
    return path.resolve(process.env.NEXUS_REPO_ROOT);
  }

  let current = path.resolve(process.cwd());
  while (true) {
    const contextDir = path.join(current, ".nexus", "context");
    if (fsSync.existsSync(contextDir)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return path.resolve(process.cwd(), "../..");
}

export function resolveContextFileTarget(contextFile: string): string {
  const trimmed = contextFile.trim();
  if (!trimmed) {
    throw makeLocalError(
      "invalid_context_target",
      "Context file is required.",
      "Provide a .nexus/context/... markdown file path.",
      [],
    );
  }

  const repoRoot = resolveRepoRoot();
  const resolved = path.isAbsolute(trimmed) ? path.normalize(trimmed) : path.resolve(repoRoot, trimmed);
  const contextRoot = path.join(repoRoot, ".nexus", "context") + path.sep;

  if (!resolved.startsWith(contextRoot) || !resolved.endsWith(".md")) {
    throw makeLocalError(
      "invalid_context_target",
      "Context file must be under .nexus/context and end with .md.",
      "Use context paths from the graph such as .nexus/context/<project>/<feature>/<id>.md.",
      [trimmed],
    );
  }
  if (!fsSync.existsSync(resolved)) {
    throw makeLocalError(
      "invalid_context_target",
      `Context file does not exist: ${trimmed}`,
      "Refresh the graph and retry with a valid context path.",
      [trimmed],
    );
  }

  return resolved;
}

export function createNadStatusAdapter(options: AdapterOptions = {}): NadStatusAdapter {
  const binary = options.binary ?? process.env.NEXUS_ADAPTER_OPENER ?? DEFAULT_BINARY;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const executor = options.executor ?? new ProcessCommandExecutor();

  return {
    async status(contextFile: string): Promise<NadStatusResult> {
      const resolvedTarget = resolveContextFileTarget(contextFile);
      const args = buildStatusArgs(resolvedTarget);
      const source: NadCommandMetadata = {
        binary,
        commandName: "orchestration.status",
        args,
        durationMs: 0,
        exitStatus: null,
        timedOut: false,
      };

      let output: CommandOutput;
      try {
        output = await executor.run(binary, args, timeoutMs);
      } catch (error) {
        if (error instanceof Error && error.message === "binary_missing") {
          throw {
            category: "binary_missing",
            message: `CLI binary '${binary}' is not available.`,
            remediation: "Install OpenNexus or set NEXUS_ADAPTER_OPENER to a valid executable path.",
            source,
          } satisfies NadStatusAdapterError;
        }

        throw {
          category: "command_failed",
          message: error instanceof Error ? error.message : "Command execution failed.",
          remediation: "Retry and inspect system command execution permissions.",
          source,
        } satisfies NadStatusAdapterError;
      }

      const metadata: NadCommandMetadata = {
        ...source,
        durationMs: output.durationMs,
        exitStatus: output.exitStatus,
        timedOut: output.timedOut,
      };

      if (output.timedOut) {
        throw {
          category: "command_timeout",
          message: `Command timed out after ${output.durationMs} ms.`,
          remediation: "Retry or increase query timeout in adapter configuration.",
          source: metadata,
        } satisfies NadStatusAdapterError;
      }

      if ((output.exitStatus ?? -1) !== 0) {
        throw normalizeCommandFailure(output.stderr, output.stdout, metadata);
      }

      const jsonPayload = parseJsonPayload(output.stdout, metadata);
      const payload = mapAndValidateStatusPayload(jsonPayload, metadata);

      return {
        payload,
        command: metadata,
      };
    },
  };
}

function normalizeCommandFailure(stderr: string, stdout: string, source: NadCommandMetadata): NadStatusAdapterError {
  const combined = `${stderr}\n${stdout}`.toLowerCase();
  if (combined.includes("no active orchestration run")) {
    return {
      category: "no_active_run",
      message: "No active orchestration run found for this context.",
      remediation: "The pipeline may be idle or complete; refresh later.",
      source,
    };
  }

  if (combined.includes("context file") && (combined.includes("not exist") || combined.includes("unable to read"))) {
    return {
      category: "invalid_context_target",
      message: "Context file target is invalid for orchestration status query.",
      remediation: "Use a valid .nexus/context/... markdown path.",
      source,
    };
  }

  return {
    category: "command_failed",
    message: stderr.trim() || "Orchestration command failed.",
    remediation: "Review orchestration CLI output and retry.",
    source,
  };
}

function parseJsonPayload(stdout: string, source: NadCommandMetadata): unknown {
  const trimmed = stdout.trim();
  if (!trimmed) {
    throw {
      category: "invalid_json",
      message: "Command returned empty stdout in JSON mode.",
      remediation: "Ensure orchestration command emits --format json output.",
      source,
    } satisfies NadStatusAdapterError;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    for (let i = trimmed.length - 1; i >= 0; i -= 1) {
      if (trimmed[i] !== "{" && trimmed[i] !== "[") {
        continue;
      }
      try {
        return JSON.parse(trimmed.slice(i));
      } catch {
        continue;
      }
    }
  }

  throw {
    category: "invalid_json",
    message: "Could not parse orchestration status JSON payload.",
    remediation: "Ensure command output is valid JSON with --format json.",
    source,
  } satisfies NadStatusAdapterError;
}

function mapAndValidateStatusPayload(jsonPayload: unknown, source: NadCommandMetadata): NadPipelineStatus {
  if (!jsonPayload || typeof jsonPayload !== "object" || Array.isArray(jsonPayload)) {
    throw {
      category: "contract_missing_fields",
      message: "Status payload must be a JSON object.",
      remediation: "Update CLI output contract for orchestration status to object format.",
      source,
    } satisfies NadStatusAdapterError;
  }

  const row = jsonPayload as Record<string, unknown>;
  const contextFile = asNonEmptyString(row.context_file);
  const status = asNonEmptyString(row.status);
  const message = asNonEmptyString(row.message);
  if (!contextFile || !status || !message) {
    throw {
      category: "contract_missing_fields",
      message: "Status payload missing required fields: context_file, status, or message.",
      remediation: "Return required orchestration status fields in CLI JSON output.",
      source,
    } satisfies NadStatusAdapterError;
  }

  return {
    contextFile,
    pipelineName: asOptionalString(row.pipeline_name),
    runId: asOptionalNumber(row.run_id),
    status,
    terminalReason: asOptionalString(row.terminal_reason),
    startedAt: asOptionalNumber(row.started_at),
    endedAt: asOptionalNumber(row.ended_at),
    message,
    remediation: asOptionalString(row.remediation),
    activeRunIds: asNumberArray(row.active_run_ids),
  };
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asOptionalString(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  return typeof value === "string" ? value : null;
}

function asOptionalNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return null;
}

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is number => typeof entry === "number" && Number.isFinite(entry));
}

function makeLocalError(
  category: NadStatusErrorCategory,
  message: string,
  remediation: string,
  args: string[],
): NadStatusAdapterError {
  return {
    category,
    message,
    remediation,
    source: {
      binary: process.env.NEXUS_ADAPTER_OPENER ?? DEFAULT_BINARY,
      commandName: "orchestration.status",
      args,
      durationMs: 0,
      exitStatus: null,
      timedOut: false,
    },
  };
}
