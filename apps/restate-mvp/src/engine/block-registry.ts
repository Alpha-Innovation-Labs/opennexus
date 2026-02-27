import { assignWorktreeBlock } from "../blocks/assign-worktree.block";
import { assertCommandStatusBlock } from "../blocks/assert-command-status.block";
import { assertTestFilesExistBlock } from "../blocks/assert-test-files-exist.block";
import { deriveTestTargetsBlock } from "../blocks/derive-test-targets.block";
import { executeCommandBlock } from "../blocks/execute-command.block";
import { finalizeResultBlock } from "../blocks/finalize-result.block";
import { opencodePromptBlock } from "../blocks/opencode-prompt.block";
import { prepareContextBlock } from "../blocks/prepare-context.block";
import { resolveTestRunnerBlock } from "../blocks/resolve-test-runner.block";
import { summarizeTextBlock } from "../blocks/summarize-text.block";
import type { PipelineBlock } from "./types";

const blocks: PipelineBlock[] = [
  assignWorktreeBlock,
  prepareContextBlock,
  deriveTestTargetsBlock,
  resolveTestRunnerBlock,
  opencodePromptBlock,
  executeCommandBlock,
  assertCommandStatusBlock,
  assertTestFilesExistBlock,
  summarizeTextBlock,
  finalizeResultBlock,
];

export const blockRegistry = new Map<string, PipelineBlock>(blocks.map((block) => [block.id, block]));
