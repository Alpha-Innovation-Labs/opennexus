import { access } from "node:fs/promises";
import { resolve } from "node:path";

import type { PipelineBlock } from "../engine/types";
import { asString } from "../shared/values";

export const assertTestFilesExistBlock: PipelineBlock = {
  id: "assert_test_files_exist",
  run: async ({ step, params, state }) => {
    const sourceStep = asString(params.source_step);
    const sourceKey = asString(params.source_key) || "required_test_paths";
    const source = state.steps[sourceStep];
    if (!sourceStep || !source) {
      throw new Error(`Step ${step.id} requires existing source_step`);
    }

    const paths = normalizePaths(source[sourceKey]);
    const cwd = state.runtime.defaultWorkingDirectory;
    const missing: string[] = [];
    for (const relativePath of paths) {
      const absolutePath = resolve(cwd, relativePath);
      try {
        await access(absolutePath);
      } catch {
        missing.push(relativePath);
      }
    }

    return {
      source_step: sourceStep,
      source_key: sourceKey,
      checked_paths: paths,
      missing_paths: missing,
      success: missing.length === 0,
    };
  },
};

function normalizePaths(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => asString(item)).filter(Boolean);
  }
  const text = asString(value);
  if (!text) {
    return [];
  }
  return text
    .split("\n")
    .map((line) => line.trim())
    .map((line) => (line.startsWith("-") ? line.slice(1).trim() : line))
    .filter(Boolean);
}
