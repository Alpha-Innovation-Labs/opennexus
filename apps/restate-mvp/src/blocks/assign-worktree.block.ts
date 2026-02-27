import type { PipelineBlock } from "../engine/types";
import { resolveRepoRoot } from "../shared/paths";
import { assignWorktree } from "../shared/worktree-manager";
import { asBoolean, asString } from "../shared/values";

export const assignWorktreeBlock: PipelineBlock = {
  id: "assign_worktree",
  run: async ({ params, state }) => {
    const enabled = asBoolean(params.use_sandbox, asBoolean(state.config.use_sandbox, true));
    const cleanup = asBoolean(params.cleanup_sandbox, asBoolean(state.config.cleanup_sandbox, true));
    const prefix = asString(params.sandbox_prefix) || asString(state.config.sandbox_prefix) || "nexus-restate-mvp";
    const requestedBaseDir = asString(params.worktree_base_dir) || asString(state.config.worktree_base_dir);
    const repoRoot = resolveRepoRoot();

    const assigned = await assignWorktree({
      repoRoot,
      enabled,
      cleanup,
      prefix,
      requestedBaseDir: requestedBaseDir || undefined,
    });

    return {
      sandbox_dir: assigned.sandboxDir,
      cleanup_sandbox: assigned.cleanup,
      used_sandbox: assigned.usedSandbox,
      worktree_base_dir: assigned.baseDir,
      runtime_default_working_directory: assigned.sandboxDir,
    };
  },
};
