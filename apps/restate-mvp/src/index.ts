import * as restate from "@restatedev/restate-sdk";

import { loadConfig, loadPipeline } from "./engine/pipeline-loader";
import { createInitialRuntimeState, executePipelineStep } from "./engine/runner";
import type { PipelineState, RunInput } from "./engine/types";
import { asString } from "./shared/values";

const workflow = restate.workflow({
  name: "ConversationWorkflow",
  handlers: {
    run: async (ctx: restate.WorkflowContext, input: RunInput): Promise<Record<string, unknown>> => {
      const pipelineFile = input.pipelineFile ?? "pipelines/configurable-five-step.yaml";
      const configFile = input.configFile ?? "configs/local-weather.yaml";

      const pipeline = await ctx.run("__load_pipeline__", async () => loadPipeline(pipelineFile));
      const config = await ctx.run("__load_config__", async () => loadConfig(configFile));

      const state: PipelineState = {
        input,
        config,
        steps: {},
        runtime: createInitialRuntimeState(),
      };

      for (const step of pipeline.steps) {
        const output = await ctx.run(step.id, async () => executePipelineStep(step, state));
        state.steps[step.id] = output;
      }

      const prepare = state.steps.prepare_context ?? {};
      const firstAnswer = state.steps.generate_red_tests ?? {};
      const summary = state.steps.validate_red_phase ?? {};
      const final = state.steps.finalize_run ?? {};
      const worktree = state.steps.assign_worktree ?? {};

      return {
        pipeline_name: pipeline.name,
        config_file: configFile,
        worktree_dir: asString(worktree.sandbox_dir),
        worktree_base_dir: asString(worktree.worktree_base_dir),
        step_1_prompt: asString(prepare.prepared_prompt),
        step_2_opencode_answer: asString(firstAnswer.response_text),
        step_3_explanation: asString(summary.summary_text),
        result_text: asString(final.result_text) || asString(firstAnswer.response_text),
        steps: state.steps,
      };
    },
  },
});

restate.serve({
  services: [workflow],
});
