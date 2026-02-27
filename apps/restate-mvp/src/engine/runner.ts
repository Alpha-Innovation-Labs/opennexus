import { resolveRepoRoot } from "../shared/paths";
import { resolveParams } from "../shared/template";
import { asString } from "../shared/values";
import { blockRegistry } from "./block-registry";
import type { PipelineState, PipelineStep, StepOutput } from "./types";

export async function executePipelineStep(step: PipelineStep, state: PipelineState): Promise<StepOutput> {
  const block = blockRegistry.get(step.block_id);
  if (!block) {
    throw new Error(`Unknown block_id '${step.block_id}' for step '${step.id}'`);
  }

  const params = resolveParams(step.params ?? {}, state) as Record<string, unknown>;
  const output = await block.run({
    step,
    params,
    state,
  });

  const runtimeDirectory = asString(output.runtime_default_working_directory);
  if (runtimeDirectory) {
    state.runtime.defaultWorkingDirectory = runtimeDirectory;
  }

  return output;
}

export function createInitialRuntimeState(): PipelineState["runtime"] {
  return {
    defaultWorkingDirectory: resolveRepoRoot(),
  };
}
