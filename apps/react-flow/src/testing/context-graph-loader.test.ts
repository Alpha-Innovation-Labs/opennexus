import assert from "node:assert/strict";
import test from "node:test";

import { normalizeContextEntity, normalizeDependsOn } from "@/features/context-graph/server/context-graph-loader";

test("normalizes depends_on.contexts values", () => {
  const parsed = normalizeDependsOn({
    depends_on: {
      contexts: [" ORC_001 ", { id: "ORC_002" }, 3, ""],
    },
  });

  assert.deepEqual(parsed, ["ORC_001", "ORC_002"]);
});

test("normalizes context markdown into node entity", () => {
  const source = `---
context_id: ORC_004
title: Context Dependency Graph and Blocking Gate
project: nexus-cli
feature: orchestration
depends_on:
  contexts:
    - ORC_003
---

# ORC_004

Body text`;

  const context = normalizeContextEntity(
    "/repo/.nexus/context/nexus-cli/orchestration/ORC_004-context-dependency-graph-and-blocking-gate.md",
    source,
    "/repo",
    new Map(),
  );

  assert.equal(context.id, "ORC_004");
  assert.equal(context.title, "Context Dependency Graph and Blocking Gate");
  assert.equal(context.project, "nexus-cli");
  assert.equal(context.feature, "orchestration");
  assert.equal(context.featureTitle, "orchestration");
  assert.equal(context.isAdapterAuthored, false);
  assert.equal(context.path, ".nexus/context/nexus-cli/orchestration/ORC_004-context-dependency-graph-and-blocking-gate.md");
  assert.deepEqual(context.dependsOn, ["ORC_003"]);
  assert.match(context.content, /Body text/);
});
