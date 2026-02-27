import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import YAML from "yaml";

import { resolveFromServiceRoot } from "../shared/paths";
import { asString } from "../shared/values";
import type { PipelineDefinition, PipelineStep } from "./types";

export async function loadPipeline(filePath: string): Promise<PipelineDefinition> {
  const parsed = await loadStructuredFile(resolveFromServiceRoot(filePath));
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid pipeline definition: ${filePath}`);
  }

  const name = asString((parsed as Record<string, unknown>).name) || "unnamed-pipeline";
  const stepsValue = (parsed as Record<string, unknown>).steps;
  if (!Array.isArray(stepsValue)) {
    throw new Error(`Pipeline '${name}' must include a 'steps' array`);
  }

  const steps: PipelineStep[] = stepsValue.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`Pipeline step at index ${index} is invalid`);
    }

    const objectEntry = entry as Record<string, unknown>;
    const id = asString(objectEntry.id);
    const blockId = asString(objectEntry.block_id) || asString(objectEntry.type);
    if (!id || !blockId) {
      throw new Error(`Pipeline step at index ${index} must include id and block_id`);
    }

    const paramsRaw = objectEntry.params;
    const params = typeof paramsRaw === "object" && paramsRaw !== null ? (paramsRaw as Record<string, unknown>) : {};

    return {
      id,
      block_id: blockId,
      params,
    };
  });

  return { name, steps };
}

export async function loadConfig(filePath: string): Promise<Record<string, unknown>> {
  const parsed = await loadStructuredFile(resolveFromServiceRoot(filePath));
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid config definition: ${filePath}`);
  }
  return parsed as Record<string, unknown>;
}

async function loadStructuredFile(pathValue: string): Promise<unknown> {
  const raw = await readFile(pathValue, "utf-8");
  const extension = extname(pathValue).toLowerCase();
  return extension === ".json" ? JSON.parse(raw) : YAML.parse(raw);
}
