import { readFile } from "node:fs/promises";

import type { PipelineBlock } from "../engine/types";
import { resolveFromServiceRoot, resolveRepoRoot } from "../shared/paths";
import { askOpencode } from "../shared/opencode-runtime";
import { interpolateTemplate } from "../shared/template";
import { asString } from "../shared/values";

export const opencodePromptBlock: PipelineBlock = {
  id: "opencode_prompt",
  run: async ({ step, params, state }) => {
    const templateConfigKey = asString(params.template_config_key);
    const templateFromConfig = templateConfigKey ? asString(state.config[templateConfigKey]) : "";
    const templateFile = templateFromConfig || asString(params.template_file);
    if (!templateFile) {
      throw new Error(`Step ${step.id} is missing required param 'template_file'`);
    }

    const outputKey = asString(params.output_key) || "response_text";
    const template = await readFile(resolveFromServiceRoot(templateFile), "utf-8");
    const prompt = interpolateTemplate(template, state);
    const workingDirectory =
      asString(params.working_directory) || state.runtime.defaultWorkingDirectory || resolveRepoRoot();
    const response = await askOpencode(prompt, workingDirectory);

    return {
      prompt_template: templateFile,
      prompt,
      working_directory: workingDirectory,
      [outputKey]: response,
    };
  },
};
