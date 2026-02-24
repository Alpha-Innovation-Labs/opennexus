import type { ContextOption, NextActionRow } from "@/entities/workspace/types";
import { listWorkspaceFiles, readWorkspaceFile } from "@/features/workspace/server/context-workspace-files";

export function parseFrontmatterValue(source: string, key: string): string {
  const frontmatterMatch = source.match(/^---\n([\s\S]*?)\n---/);
  if (!frontmatterMatch) {
    return "";
  }

  const lineMatch = frontmatterMatch[1].match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  if (!lineMatch) {
    return "";
  }

  return lineMatch[1].replaceAll('"', "").trim();
}

export function parseNextActionsRows(source: string): NextActionRow[] {
  const sectionMatch = source.match(/## Next Actions\n\n\| Description \| Test \|\n\|[-| ]+\|\n([\s\S]*?)(\n## |$)/);
  if (!sectionMatch) {
    return [];
  }

  const rows = sectionMatch[1]
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("|"));

  return rows
    .map((line) => {
      const columns = line
        .split("|")
        .map((column) => column.trim())
        .filter(Boolean);

      const description = columns[0] ?? "";
      const rawTest = columns[1] ?? "";
      const testId = rawTest.replaceAll("`", "");

      return { description, testId };
    })
    .filter((row) => row.description.length > 0 && row.testId.length > 0);
}

export function listContextOptions(): ContextOption[] {
  return listWorkspaceFiles()
    .filter((file) => file.group === "context")
    .map((file) => {
      const source = readWorkspaceFile(file.path).content;
      const contextId = parseFrontmatterValue(source, "context_id");
      const title = parseFrontmatterValue(source, "title") || file.name;
      return { contextId, title, filePath: file.path };
    })
    .filter((item) => item.contextId.length > 0)
    .sort((left, right) => left.contextId.localeCompare(right.contextId));
}

export function loadContextRows(contextFilePath: string): { contextId: string; rows: NextActionRow[] } {
  const source = readWorkspaceFile(contextFilePath).content;
  const contextId = parseFrontmatterValue(source, "context_id");

  return {
    contextId,
    rows: parseNextActionsRows(source),
  };
}
