import test from "node:test";
import assert from "node:assert/strict";

import { parseFrontmatterValue, parseNextActionsRows } from "@/features/workspace/server/context-index";

test("extracts context id from frontmatter", () => {
  const source = `---
context_id: CWB_777
title: Sample
---
\n# Example\n`;

  assert.equal(parseFrontmatterValue(source, "context_id"), "CWB_777");
});

test("parses next action rows from markdown table", () => {
  const source = `## Next Actions

| Description | Test |
|-------------|------|
| Start row execution | \`workspace_start\` |
| Show row status | \`workspace_status\` |
`;

  assert.deepEqual(parseNextActionsRows(source), [
    { description: "Start row execution", testId: "workspace_start" },
    { description: "Show row status", testId: "workspace_status" },
  ]);
});
