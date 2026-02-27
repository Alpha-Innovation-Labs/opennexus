import type { PipelineBlock } from "../engine/types";
import { asBoolean, asString } from "../shared/values";

export const assertCommandStatusBlock: PipelineBlock = {
  id: "assert_command_status",
  run: async ({ step, params, state }) => {
    const sourceStep = asString(params.source_step);
    const expectSuccess = asBoolean(params.expect_success, true);
    const source = state.steps[sourceStep];

    if (!sourceStep || !source) {
      throw new Error(`Step ${step.id} requires existing source_step`);
    }

    const actualSuccess = asBoolean(source.success, false);
    if (actualSuccess !== expectSuccess) {
      const stderr = asString(source.stderr);
      const stdout = asString(source.stdout);
      throw new Error(
        `Command status assertion failed for '${sourceStep}': expected success=${String(expectSuccess)} actual success=${String(actualSuccess)} stdout='${stdout}' stderr='${stderr}'`,
      );
    }

    return {
      source_step: sourceStep,
      expected_success: expectSuccess,
      actual_success: actualSuccess,
      assertion_passed: true,
    };
  },
};
