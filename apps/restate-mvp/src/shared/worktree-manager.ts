import { execFile } from "node:child_process";
import { mkdir, mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

import { expandHome, resolveProjectName } from "./paths";
import { extractError } from "./values";

const execFileAsync = promisify(execFile);

export type WorktreeAssignment = {
  sandboxDir: string;
  cleanup: boolean;
  usedSandbox: boolean;
  baseDir: string;
};

export async function assignWorktree(params: {
  repoRoot: string;
  enabled: boolean;
  cleanup: boolean;
  prefix: string;
  requestedBaseDir?: string;
}): Promise<WorktreeAssignment> {
  const projectName = resolveProjectName(params.repoRoot);
  const baseDir = resolveWorktreeBaseDir(projectName, params.requestedBaseDir);

  if (!params.enabled) {
    return {
      sandboxDir: params.repoRoot,
      cleanup: false,
      usedSandbox: false,
      baseDir,
    };
  }

  await mkdir(baseDir, { recursive: true });
  const sandboxDir = await mkdtemp(join(baseDir, `${params.prefix}-`));
  await execFileAsync("git", ["worktree", "add", "--detach", sandboxDir, "HEAD"], {
    cwd: params.repoRoot,
  });

  return {
    sandboxDir,
    cleanup: params.cleanup,
    usedSandbox: true,
    baseDir,
  };
}

export async function cleanupWorktree(repoRoot: string, sandboxDir: string): Promise<string> {
  try {
    await execFileAsync("git", ["worktree", "remove", "--force", sandboxDir], {
      cwd: repoRoot,
    });
    return "removed";
  } catch (error) {
    return `remove_failed: ${extractError(error)}`;
  }
}

function resolveWorktreeBaseDir(projectName: string, requestedBaseDir?: string): string {
  const configuredBase =
    requestedBaseDir || process.env.RBX_WORKTREE_BASE_DIR || process.env.RBX_WORKTREE_ROOT || "~/.worktrees";
  const expandedBase = expandHome(configuredBase);
  return join(expandedBase, projectName);
}
