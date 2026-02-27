import { execFile } from "node:child_process";
import { promisify } from "node:util";

import type { PipelineBlock } from "../engine/types";
import { asString } from "../shared/values";

const execFileAsync = promisify(execFile);

export const executeCommandBlock: PipelineBlock = {
  id: "execute_command",
  run: async ({ step, params, state }) => {
    const command = asString(params.command);
    if (!command) {
      throw new Error(`Step ${step.id} requires param 'command'`);
    }

    const workingDirectory =
      asString(params.working_directory) || state.runtime.defaultWorkingDirectory;
    const timeoutMs = Number(asString(params.timeout_ms) || "120000");

    try {
      const { stdout, stderr } = await execFileAsync("bash", ["-lc", command], {
        cwd: workingDirectory,
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
      });
      return {
        command,
        working_directory: workingDirectory,
        exit_code: 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        success: true,
      };
    } catch (error) {
      const maybe = error as { code?: number | string; stdout?: string; stderr?: string; message?: string };
      return {
        command,
        working_directory: workingDirectory,
        exit_code: typeof maybe.code === "number" ? maybe.code : 1,
        stdout: (maybe.stdout ?? "").trim(),
        stderr: (maybe.stderr ?? maybe.message ?? "").trim(),
        success: false,
      };
    }
  },
};
