import { NextRequest, NextResponse } from "next/server";

import { executeRow } from "@/features/workspace/server/workspace-service";

type ExecutePayload = {
  contextId: string;
  contextFile: string;
  testId: string;
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json()) as ExecutePayload;

  if (!body.contextId || !body.contextFile || !body.testId) {
    return NextResponse.json(
      { error: "Missing required fields: contextId, contextFile, testId." },
      { status: 400 },
    );
  }

  const started = executeRow(body);
  if (!started.ok) {
    return NextResponse.json({ error: started.error }, { status: 409 });
  }

  return NextResponse.json({
    ok: true,
    executionId: started.executionId,
    message:
      "Execution started. Backend receives CDD_SELECTED_TEST for row identity and full context-file command path.",
  });
}
