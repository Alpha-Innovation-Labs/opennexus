import type { PipelineBlock } from "../engine/types";
import { resolveRepoRoot } from "../shared/paths";
import { cleanupWorktree } from "../shared/worktree-manager";
import { asBoolean, asString } from "../shared/values";

export const finalizeResultBlock: PipelineBlock = {
  id: "finalize_result",
  run: async ({ params, state }) => {
    const primaryStep = asString(params.primary_step);
    const primaryKey = asString(params.primary_key);
    const summaryStep = asString(params.summary_step);
    const summaryKey = asString(params.summary_key);
    const finalStep = asString(params.final_step);
    const finalKey = asString(params.final_key);
    const worktreeStep = asString(params.worktree_step) || "assign_worktree";

    const primaryText = asString(state.steps[primaryStep]?.[primaryKey]);
    const summaryText = asString(state.steps[summaryStep]?.[summaryKey]);
    const finalText = asString(state.steps[finalStep]?.[finalKey]);

    const sandboxDir = asString(state.steps[worktreeStep]?.sandbox_dir);
    const usedSandbox = asBoolean(state.steps[worktreeStep]?.used_sandbox, false);
    const cleanupSandbox = asBoolean(state.steps[worktreeStep]?.cleanup_sandbox, false);

    let cleanupStatus = "skipped";
    if (usedSandbox && cleanupSandbox && sandboxDir) {
      cleanupStatus = await cleanupWorktree(resolveRepoRoot(), sandboxDir);
    }

    return {
      result_text: finalText || primaryText || summaryText,
      summary_text: summaryText,
      primary_text: primaryText,
      final_text: finalText,
      sandbox_cleanup: cleanupStatus,
    };
  },
};
