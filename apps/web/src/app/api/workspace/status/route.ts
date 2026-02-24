import { NextRequest, NextResponse } from "next/server";

import { getTaskStatus } from "@/features/workspace/server/workspace-service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const contextId = request.nextUrl.searchParams.get("contextId");
  const testId = request.nextUrl.searchParams.get("testId");

  if (!contextId || !testId) {
    return NextResponse.json({ error: "Missing contextId or testId query parameters." }, { status: 400 });
  }

  return NextResponse.json(getTaskStatus(contextId, testId));
}
