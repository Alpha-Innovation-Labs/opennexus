import type { ContextOption, LiveSessionSnapshot, NextActionRow, TaskStatusSnapshot } from "@/entities/workspace/types";
import { listContextOptions, loadContextRows } from "@/features/workspace/server/context-index";
import { getLiveSession, startExecution } from "@/features/workspace/server/runtime-store";
import { readTaskStatus } from "@/features/workspace/server/sqlite-store";

export function getContextOptions(): ContextOption[] {
  return listContextOptions();
}

export function getNextActionRows(contextFile: string): { contextId: string; rows: NextActionRow[] } {
  return loadContextRows(contextFile);
}

export function executeRow(input: {
  contextId: string;
  contextFile: string;
  testId: string;
}): { ok: true; executionId: string } | { ok: false; error: string } {
  return startExecution(input);
}

export function getTaskStatus(contextId: string, testId: string): TaskStatusSnapshot {
  return readTaskStatus(contextId, testId);
}

export function getLiveStream(contextFile: string, testId: string): LiveSessionSnapshot {
  return getLiveSession(contextFile, testId);
}
