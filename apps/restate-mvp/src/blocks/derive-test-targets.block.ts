import type { PipelineBlock } from "../engine/types";
import { asString } from "../shared/values";

export const deriveTestTargetsBlock: PipelineBlock = {
  id: "derive_test_targets",
  run: async ({ state }) => {
    const promptFile = asString(state.steps.prepare_context?.prompt_file);
    const contextText = asString(state.steps.prepare_context?.prompt_text);
    const toolchain = (asString(state.config.test_toolchain) || "python").toLowerCase();

    const outputDir = deriveContextTestOutputDir(promptFile);
    const testIds = parseNextActionTestIds(contextText);
    const requiredTestFiles = testIds.map((testId) => testFileName(testId, toolchain));
    const requiredTestPaths = requiredTestFiles.map((file) => `${outputDir}/${file}`);

    return {
      toolchain,
      test_ids: testIds,
      output_dir: outputDir,
      required_test_files: requiredTestFiles,
      required_test_paths: requiredTestPaths,
      required_test_paths_text: requiredTestPaths.map((path) => `- ${path}`).join("\n"),
    };
  },
};

function parseNextActionTestIds(contextMarkdown: string): string[] {
  const ids: string[] = [];
  const regex = /\|[^|]*\|\s*`([^`]+)`\s*\|/g;
  for (const match of contextMarkdown.matchAll(regex)) {
    const value = (match[1] ?? "").trim();
    if (!value || value.toLowerCase() === "test") {
      continue;
    }
    ids.push(value);
  }
  return ids;
}

function deriveContextTestOutputDir(contextFile: string): string {
  const normalized = contextFile.replaceAll("\\", "/");
  const parts = normalized.split("/").filter(Boolean);
  const contextIndex = parts.lastIndexOf("context");
  if (contextIndex < 0 || contextIndex >= parts.length - 1) {
    return "tests/context/context";
  }

  const scopedParts = parts.slice(contextIndex + 1);
  const fileName = scopedParts.pop() ?? "context.md";
  const stem = fileName.includes(".") ? fileName.slice(0, fileName.lastIndexOf(".")) : fileName;

  const output = ["tests", ...scopedParts.map(sanitizeForPath), sanitizeForPath(stem)];
  return output.join("/");
}

function testFileName(testId: string, toolchain: string): string {
  const base = sanitizeForPath(testId);
  if (toolchain === "rust") {
    return `${base}.rs`;
  }
  if (toolchain === "node") {
    return `${base}.test.js`;
  }
  return `test_${base}.py`;
}

function sanitizeForPath(input: string): string {
  let value = input
    .split("")
    .map((ch) => (/^[A-Za-z0-9_-]$/.test(ch) ? ch : "_"))
    .join("")
    .toLowerCase();

  while (value.includes("__")) {
    value = value.replaceAll("__", "_");
  }

  const trimmed = value.replace(/^_+|_+$/g, "");
  return trimmed || "context";
}
