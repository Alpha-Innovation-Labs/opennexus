import assert from "node:assert/strict";
import test from "node:test";

import {
  closeContextDetails,
  createContextDetailsInitialState,
  openContextDetails,
} from "@/features/context-graph/model/context-details-state";

test("opens and closes context details modal state on node click flow", () => {
  const initial = createContextDetailsInitialState();

  const opened = openContextDetails(initial, {
    id: "ORC_004",
    title: "Context Dependency Graph and Blocking Gate",
    project: "nexus-cli",
    feature: "orchestration",
    featureTitle: "nexus-cli orchestration",
    isAdapterAuthored: false,
    path: ".nexus/context/nexus-cli/orchestration/ORC_004-context-dependency-graph-and-blocking-gate.md",
    content: "Body",
    dependsOn: ["ORC_003"],
  });

  assert.equal(opened.isOpen, true);
  assert.equal(opened.selectedContext?.id, "ORC_004");

  const closed = closeContextDetails(opened);
  assert.equal(closed.isOpen, false);
  assert.equal(closed.selectedContext, null);
});
