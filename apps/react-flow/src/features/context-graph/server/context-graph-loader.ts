import fsSync from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

import { mapDependencyEdges } from "@/features/context-graph/model/context-graph-edges";
import type { ContextGraphData, ContextNodeEntity } from "@/features/context-graph/model/context-graph-types";
import { logger } from "@/shared/server/logger";

function resolveRepoRoot(): string {
  if (process.env.NEXUS_REPO_ROOT) {
    return path.resolve(process.env.NEXUS_REPO_ROOT);
  }

  let current = path.resolve(process.cwd());

  while (true) {
    const contextDir = path.join(current, ".nexus", "context");
    if (fsSync.existsSync(contextDir)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }

    current = parent;
  }

  return path.resolve(process.cwd(), "../..");
}

async function collectMarkdownFiles(directoryPath: string): Promise<string[]> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(entryPath);
    }
  }

  return files;
}

function isIgnoredContextPath(filePath: string, repoRoot: string): boolean {
  const normalized = path.relative(repoRoot, filePath).replaceAll("\\", "/");
  return normalized.includes("/_reference/") || normalized.includes("/skill/");
}

function hasRequiredContextFrontmatter(data: Record<string, unknown>): boolean {
  const requiredStringKeys = ["context_id", "title", "project", "feature", "created"] as const;
  return requiredStringKeys.every((key) => typeof data[key] === "string" && data[key].trim().length > 0);
}

function normalizeDependsOn(frontmatterData: Record<string, unknown>): string[] {
  const dependsOn = frontmatterData.depends_on;
  if (!dependsOn || typeof dependsOn !== "object" || Array.isArray(dependsOn)) {
    return [];
  }

  const contexts = (dependsOn as { contexts?: unknown }).contexts;
  if (!Array.isArray(contexts)) {
    return [];
  }

  return contexts
    .map((value) => {
      if (typeof value === "string") {
        return value;
      }

      if (value && typeof value === "object" && !Array.isArray(value)) {
        const id = (value as { id?: unknown }).id;
        if (typeof id === "string") {
          return id;
        }
      }

      return "";
    })
    .map((value) => value.trim())
    .filter(Boolean);
}

function hasAdapterMarker(value: unknown): boolean {
  return typeof value === "string" && /adapter/i.test(value);
}

function inferAdapterAuthoredContext(data: Record<string, unknown>, id: string, title: string, project: string): boolean {
  if (hasAdapterMarker(data.created_by) || hasAdapterMarker(data.generator) || hasAdapterMarker(data.source)) {
    return true;
  }

  if (/^NAD_/i.test(id)) {
    return true;
  }

  if (/adapter/i.test(project) || /\badapter\b/i.test(title)) {
    return true;
  }

  return false;
}

function extractMarkdownTitle(markdownSource: string): string | null {
  const parsed = matter(markdownSource);
  const frontmatterTitle = parsed.data?.title;
  if (typeof frontmatterTitle === "string" && frontmatterTitle.trim().length > 0) {
    return frontmatterTitle.trim();
  }

  const firstHeading = parsed.content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("# "));
  if (!firstHeading) {
    return null;
  }

  const heading = firstHeading.replace(/^#\s+/, "").trim();
  return heading.length > 0 ? heading : null;
}

function buildFeatureTitleByKey(markdownFiles: string[], repoRoot: string): Map<string, string> {
  const titleByFeatureKey = new Map<string, string>();

  for (const filePath of markdownFiles) {
    if (path.basename(filePath).toLowerCase() !== "index.md") {
      continue;
    }

    const normalized = path.relative(repoRoot, filePath).replaceAll("\\", "/");
    if (!normalized.startsWith(".nexus/context/")) {
      continue;
    }

    const relativeFromContextRoot = normalized.replace(/^\.nexus\/context\//, "");
    const parts = relativeFromContextRoot.split("/");
    const project = parts[0];
    const feature = parts.slice(1, -1).join("/");
    if (!project || !feature) {
      continue;
    }

    const source = fsSync.readFileSync(filePath, "utf-8");
    const title = extractMarkdownTitle(source);
    if (!title) {
      continue;
    }

    titleByFeatureKey.set(`${project}/${feature}`, title);
  }

  return titleByFeatureKey;
}

function normalizeContextEntity(
  filePath: string,
  fileSource: string,
  repoRoot: string,
  featureTitleByKey: Map<string, string>,
): ContextNodeEntity {
  const parsed = matter(fileSource);
  const data = parsed.data as Record<string, unknown>;
  const normalizedPath = path.relative(repoRoot, filePath).replaceAll("\\", "/");
  const relativeFromContextRoot = normalizedPath.replace(/^\.nexus\/context\//, "");
  const parts = relativeFromContextRoot.split("/");
  const project = parts[0] ?? "unknown-project";
  const feature = parts.length > 2 ? parts.slice(1, -1).join("/") : parts[1] ?? "general";
  const featureTitle = featureTitleByKey.get(`${project}/${feature}`) ?? feature;
  const basename = path.basename(filePath, ".md");
  const id = typeof data.context_id === "string" && data.context_id.trim().length > 0 ? data.context_id.trim() : basename;
  const title = typeof data.title === "string" && data.title.trim().length > 0 ? data.title.trim() : id;
  const isAdapterAuthored = inferAdapterAuthoredContext(data, id, title, project);

  return {
    id,
    title,
    project,
    feature,
    featureTitle,
    isAdapterAuthored,
    path: normalizedPath,
    content: parsed.content.trim(),
    dependsOn: normalizeDependsOn(data),
  };
}

function ensureUniqueContextIds(contexts: ContextNodeEntity[]): ContextNodeEntity[] {
  const seen = new Map<string, number>();

  return contexts.map((context) => {
    const count = seen.get(context.id) ?? 0;
    seen.set(context.id, count + 1);

    if (count === 0) {
      return context;
    }

    const fallbackKey = context.path.replace(/\.md$/i, "").replace(/[^a-zA-Z0-9/_-]/g, "-");
    const uniqueId = `${context.id}__${fallbackKey}`;

    return {
      ...context,
      id: uniqueId,
    };
  });
}

export async function loadContextGraphData(): Promise<ContextGraphData> {
  const repoRoot = resolveRepoRoot();
  const contextRoot = path.join(repoRoot, ".nexus", "context");

  let markdownFiles: string[] = [];

  try {
    markdownFiles = await collectMarkdownFiles(contextRoot);
  } catch {
    logger.warn({ contextRoot }, "Context root not found, returning empty graph");
    return {
      projects: [],
      contexts: [],
      unresolvedDependencies: [],
    };
  }

  const contexts: ContextNodeEntity[] = [];
  const featureTitleByKey = buildFeatureTitleByKey(markdownFiles, repoRoot);

  for (const filePath of markdownFiles.sort((left, right) => left.localeCompare(right))) {
    if (isIgnoredContextPath(filePath, repoRoot)) {
      continue;
    }

    if (path.basename(filePath).toLowerCase() === "index.md") {
      continue;
    }

    const fileSource = await fs.readFile(filePath, "utf-8");
    const parsed = matter(fileSource);
    if (!hasRequiredContextFrontmatter(parsed.data as Record<string, unknown>)) {
      continue;
    }

    const context = normalizeContextEntity(filePath, fileSource, repoRoot, featureTitleByKey);
    if (context.feature === "general") {
      continue;
    }

    contexts.push(context);
  }

  const normalizedContexts = ensureUniqueContextIds(contexts).sort((left, right) => left.id.localeCompare(right.id));

  const projects = Array.from(new Set(normalizedContexts.map((context) => context.project)))
    .sort((left, right) => left.localeCompare(right))
    .map((project) => ({ id: project, label: project }));

  const edgeMapping = mapDependencyEdges(normalizedContexts);

  for (const unresolved of edgeMapping.unresolvedDependencies) {
    logger.warn(
      {
        contextId: unresolved.contextId,
        dependencyId: unresolved.dependencyId,
      },
      "Unresolved context dependency",
    );
  }

  return {
    projects,
    contexts: normalizedContexts,
    unresolvedDependencies: edgeMapping.unresolvedDependencies,
  };
}

export { normalizeContextEntity, normalizeDependsOn };
