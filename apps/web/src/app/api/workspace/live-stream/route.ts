import { NextRequest, NextResponse } from "next/server";

import { getLiveStream } from "@/features/workspace/server/workspace-service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const contextFile = request.nextUrl.searchParams.get("contextFile");
  const testId = request.nextUrl.searchParams.get("testId");

  if (!contextFile || !testId) {
    return NextResponse.json({ error: "Missing contextFile or testId query parameters." }, { status: 400 });
  }

  return NextResponse.json(getLiveStream(contextFile, testId));
}
