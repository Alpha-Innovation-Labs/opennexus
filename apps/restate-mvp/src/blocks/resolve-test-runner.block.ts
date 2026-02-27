import { access } from "node:fs/promises";
import { join } from "node:path";

import type { PipelineBlock } from "../engine/types";
import { asString } from "../shared/values";

export const resolveTestRunnerBlock: PipelineBlock = {
  id: "resolve_test_runner",
  run: async ({ state }) => {
    const configured = asString(state.config.test_command).trim();
    if (configured) {
      return { verify_command: configured, source: "config" };
    }

    const cwd = state.runtime.defaultWorkingDirectory;

    if (await exists(join(cwd, "pyproject.toml"))) {
      return { verify_command: "uv run pytest -q", source: "inferred:python" };
    }
    if (await exists(join(cwd, "Cargo.toml"))) {
      return { verify_command: "cargo test -q", source: "inferred:rust" };
    }
    if (await exists(join(cwd, "package.json"))) {
      return { verify_command: "npm test -- --runInBand", source: "inferred:node" };
    }

    return { verify_command: "uv run pytest -q", source: "default" };
  },
};

async function exists(pathValue: string): Promise<boolean> {
  try {
    await access(pathValue);
    return true;
  } catch {
    return false;
  }
}
