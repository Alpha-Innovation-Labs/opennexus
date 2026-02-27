import type { PipelineState } from "../engine/types";
import { asString } from "./values";

export function interpolateTemplate(template: string, state: PipelineState): string {
  return template.replace(/{{\s*([^}]+)\s*}}/g, (_match, expression: string) => {
    const value = resolveExpression(expression.trim(), state);
    return asString(value);
  });
}

export function resolveParams(value: unknown, state: PipelineState): unknown {
  if (typeof value === "string") {
    return interpolateTemplate(value, state);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => resolveParams(entry, state));
  }

  if (typeof value === "object" && value !== null) {
    const next: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      next[key] = resolveParams(entry, state);
    }
    return next;
  }

  return value;
}

function resolveExpression(expression: string, state: PipelineState): unknown {
  const segments = expression.split(".").filter(Boolean);
  if (segments.length === 0) {
    return "";
  }

  if (segments[0] === "input") {
    return resolvePathValue(state.input, segments.slice(1));
  }
  if (segments[0] === "config") {
    return resolvePathValue(state.config, segments.slice(1));
  }
  if (segments[0] === "steps") {
    return resolvePathValue(state.steps, segments.slice(1));
  }
  if (segments[0] === "runtime") {
    return resolvePathValue(state.runtime, segments.slice(1));
  }

  return "";
}

function resolvePathValue(root: unknown, segments: string[]): unknown {
  let current: unknown = root;
  for (const segment of segments) {
    if (typeof current !== "object" || current === null) {
      return "";
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
