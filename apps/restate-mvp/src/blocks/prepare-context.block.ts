import { readFile } from "node:fs/promises";

import type { PipelineBlock } from "../engine/types";
import { resolveFromServiceRoot } from "../shared/paths";
import { asString } from "../shared/values";

export const prepareContextBlock: PipelineBlock = {
  id: "prepare_context",
  run: async ({ params, state }) => {
    const promptFile =
      asString(state.config.prompt_file) || asString(params.prompt_file) || asString(state.input.context?.promptFile) || "prompts/weather.txt";
    const question = asString(state.config.question) || asString(params.question) || asString(state.input.context?.question);
    const promptText = (await readFile(resolveFromServiceRoot(promptFile), "utf-8")).trim();
    const preparedPrompt = question ? `${promptText}\n\nQuestion: ${question}` : promptText;

    return {
      prompt_file: promptFile,
      prompt_text: promptText,
      question,
      prepared_prompt: preparedPrompt,
    };
  },
};
