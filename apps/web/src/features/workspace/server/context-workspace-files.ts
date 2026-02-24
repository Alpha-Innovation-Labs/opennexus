import { accessSync, constants, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";

import type { WorkspaceFile, WorkspaceFileGroup } from "@/entities/workspace/types";

type SaveWorkspaceFileInput = {
  path: unknown;
  content: string;
  expectedMtimeMs?: number;
};

export class WorkspaceFileError extends Error {
  readonly code: string;
  readonly status: number;
  readonly path?: string;

  constructor(code: string, message: string, status: number, filePath?: string) {
    super(message);
    this.code = code;
    this.status = status;
    this.path = filePath;
  }
}

const resolveProjectRoot = (): string => {
  let current = process.cwd();
  while (true) {
    if (existsSync(resolve(current, ".nexus"))) {
      return current;
    }
    const parent = resolve(current, "..");
    if (parent === current) {
      return process.cwd();
    }
    current = parent;
  }
};

const PROJECT_ROOT = resolveProjectRoot();
const NEXUS_ROOT = resolve(PROJECT_ROOT, ".nexus");
const CONTEXT_PREFIX = resolve(PROJECT_ROOT, ".nexus", "context") + sep;
const RULES_PREFIX = resolve(PROJECT_ROOT, ".nexus", "rules") + sep;
const ALLOWED_PREFIXES = [CONTEXT_PREFIX, RULES_PREFIX];

const ensureNexusRoot = (): void => {
  if (!existsSync(NEXUS_ROOT)) {
    throw new WorkspaceFileError(
      "WORKSPACE_NOT_FOUND",
      `Workspace root not found at ${NEXUS_ROOT}.`,
      404,
      ".nexus",
    );
  }
};

const isWritable = (absolutePath: string): boolean => {
  try {
    accessSync(absolutePath, constants.W_OK);
    return true;
  } catch {
    return false;
  }
};

const groupForPath = (relativePath: string): WorkspaceFileGroup => {
  if (relativePath.includes("/_reference/")) {
    return "reference";
  }
  if (relativePath.startsWith(".nexus/rules/")) {
    return "rules";
  }
  return "context";
};

const normalizePath = (rawPath: unknown): { absolutePath: string; relativePath: string } => {
  if (typeof rawPath !== "string" || rawPath.trim().length === 0) {
    throw new WorkspaceFileError("INVALID_PATH", "A markdown file path is required.", 400);
  }
  const trimmedPath = rawPath.trim();
  if (!trimmedPath.startsWith(".nexus/")) {
    throw new WorkspaceFileError("INVALID_PATH", "Path must start with .nexus/", 400, trimmedPath);
  }
  if (!trimmedPath.endsWith(".md")) {
    throw new WorkspaceFileError("INVALID_PATH", "Only markdown files are supported.", 400, trimmedPath);
  }

  const absolutePath = resolve(PROJECT_ROOT, trimmedPath);
  const relativePath = trimmedPath.replaceAll("\\", "/");
  const withinAllowed = ALLOWED_PREFIXES.some((prefix) => absolutePath.startsWith(prefix));
  if (!withinAllowed) {
    throw new WorkspaceFileError(
      "INVALID_PATH",
      "Path must be inside .nexus/context or .nexus/rules.",
      400,
      relativePath,
    );
  }

  return { absolutePath, relativePath };
};

const collectMarkdownFiles = (directoryPath: string, output: string[]): void => {
  const entries = readdirSync(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = resolve(directoryPath, entry.name);
    if (entry.isDirectory()) {
      collectMarkdownFiles(absolutePath, output);
      continue;
    }
    if (entry.isFile() && absolutePath.endsWith(".md")) {
      output.push(absolutePath);
    }
  }
};

const summarizeFile = (relativePath: string, absolutePath: string): WorkspaceFile => {
  const stats = statSync(absolutePath);
  const normalizedPath = relativePath.replaceAll("\\", "/");
  return {
    path: normalizedPath,
    name: normalizedPath.split("/").at(-1) ?? normalizedPath,
    group: groupForPath(normalizedPath),
    readOnly: !isWritable(absolutePath),
    updatedAt: stats.mtime.toISOString(),
    mtimeMs: stats.mtimeMs,
  };
};

export function listWorkspaceFiles(): WorkspaceFile[] {
  ensureNexusRoot();

  const absolutePaths: string[] = [];
  if (existsSync(CONTEXT_PREFIX)) {
    collectMarkdownFiles(CONTEXT_PREFIX, absolutePaths);
  }
  if (existsSync(RULES_PREFIX)) {
    collectMarkdownFiles(RULES_PREFIX, absolutePaths);
  }

  const files = absolutePaths.map((absolutePath) => {
    const relativePath = absolutePath.slice(PROJECT_ROOT.length + 1);
    return summarizeFile(relativePath, absolutePath);
  });

  files.sort((left, right) => left.path.localeCompare(right.path));
  return files;
}

export function readWorkspaceFile(filePath: unknown): { file: WorkspaceFile; content: string } {
  ensureNexusRoot();
  const { absolutePath, relativePath } = normalizePath(filePath);
  if (!existsSync(absolutePath)) {
    throw new WorkspaceFileError("FILE_NOT_FOUND", "Selected markdown file was not found.", 404, relativePath);
  }

  try {
    const content = readFileSync(absolutePath, "utf8");
    return {
      file: summarizeFile(relativePath, absolutePath),
      content,
    };
  } catch {
    throw new WorkspaceFileError("FILE_UNREADABLE", "Unable to read markdown file from disk.", 500, relativePath);
  }
}

export function saveWorkspaceFile(input: SaveWorkspaceFileInput): { file: WorkspaceFile; content: string } {
  ensureNexusRoot();
  const { absolutePath, relativePath } = normalizePath(input.path);
  if (!existsSync(absolutePath)) {
    throw new WorkspaceFileError("FILE_NOT_FOUND", "Selected markdown file was not found.", 404, relativePath);
  }
  if (!isWritable(absolutePath)) {
    throw new WorkspaceFileError("FILE_READ_ONLY", "Selected file is read-only and cannot be saved.", 403, relativePath);
  }

  const stats = statSync(absolutePath);
  if (typeof input.expectedMtimeMs === "number" && Number.isFinite(input.expectedMtimeMs)) {
    const drift = Math.abs(stats.mtimeMs - input.expectedMtimeMs);
    if (drift > 1) {
      throw new WorkspaceFileError(
        "STALE_FILE",
        "This file changed on disk after you opened it. Reload before saving.",
        409,
        relativePath,
      );
    }
  }

  try {
    writeFileSync(absolutePath, input.content, "utf8");
  } catch {
    throw new WorkspaceFileError("WRITE_FAILED", "Unable to write markdown changes to disk.", 500, relativePath);
  }

  return readWorkspaceFile(relativePath);
}
