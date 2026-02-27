import type { PipelineBlock } from "../engine/types";
import { asString } from "../shared/values";

export const summarizeTextBlock: PipelineBlock = {
  id: "summarize_text",
  run: async ({ step, params, state }) => {
    const sourceStep = asString(params.source_step);
    const sourceKey = asString(params.source_key);
    const outputKey = asString(params.output_key) || "summary_text";

    if (!sourceStep || !sourceKey) {
      throw new Error(`Step ${step.id} requires source_step and source_key params`);
    }

    const sourceValue = asString(state.steps[sourceStep]?.[sourceKey]);
    const normalized = sourceValue.replace(/\s+/g, " ").trim();
    const summary = summarizeText(normalized);

    return {
      source_step: sourceStep,
      source_key: sourceKey,
      [outputKey]: summary,
    };
  },
};

function summarizeText(normalized: string): string {
  if (!normalized) {
    return "No answer to summarize.";
  }
  const sentence = normalized.match(/^(.+?[.!?])(\s|$)/);
  if (sentence?.[1]) {
    return sentence[1].trim();
  }
  if (normalized.length <= 200) {
    return normalized;
  }
  return `${normalized.slice(0, 197).trimEnd()}...`;
}
