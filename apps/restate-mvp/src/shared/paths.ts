import { homedir } from "node:os";
import { basename, isAbsolute, resolve } from "node:path";

export function resolveRepoRoot(): string {
  return resolve(process.cwd(), "..", "..");
}

export function resolveFromServiceRoot(pathValue: string): string {
  if (isAbsolute(pathValue)) {
    return pathValue;
  }
  return resolve(process.cwd(), pathValue);
}

export function expandHome(pathValue: string): string {
  if (pathValue === "~") {
    return homedir();
  }
  if (pathValue.startsWith("~/")) {
    return resolve(homedir(), pathValue.slice(2));
  }
  return pathValue;
}

export function resolveProjectName(repoRoot: string): string {
  return basename(repoRoot);
}
