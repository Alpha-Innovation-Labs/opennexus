import assert from "node:assert/strict";
import test from "node:test";

import { mapDependencyEdges } from "@/features/context-graph/model/context-graph-edges";
import type { ContextNodeEntity } from "@/features/context-graph/model/context-graph-types";

const fixtureContexts: ContextNodeEntity[] = [
  {
    id: "ORC_001",
    title: "One",
    project: "nexus-cli",
    feature: "orchestration",
    featureTitle: "nexus-cli orchestration",
    isAdapterAuthored: false,
    path: ".nexus/context/nexus-cli/orchestration/ORC_001.md",
    content: "",
    dependsOn: [],
  },
  {
    id: "ORC_002",
    title: "Two",
    project: "nexus-cli",
    feature: "orchestration",
    featureTitle: "nexus-cli orchestration",
    isAdapterAuthored: false,
    path: ".nexus/context/nexus-cli/orchestration/ORC_002.md",
    content: "",
    dependsOn: ["ORC_001", "MISSING_999"],
  },
];

test("maps context dependencies into directed edges and unresolved warnings", () => {
  const mapped = mapDependencyEdges(fixtureContexts);

  assert.deepEqual(mapped.edges, [
    {
      id: "dep:ORC_001->ORC_002",
      sourceContextId: "ORC_001",
      targetContextId: "ORC_002",
    },
  ]);

  assert.deepEqual(mapped.unresolvedDependencies, [
    {
      contextId: "ORC_002",
      dependencyId: "MISSING_999",
    },
  ]);
});
