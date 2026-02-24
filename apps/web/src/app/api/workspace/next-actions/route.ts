import { NextRequest, NextResponse } from "next/server";

import { WorkspaceFileError } from "@/features/workspace/server/context-workspace-files";
import { getNextActionRows } from "@/features/workspace/server/workspace-service";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const contextFile = request.nextUrl.searchParams.get("contextFile");
  if (!contextFile) {
    return NextResponse.json({ error: "Missing contextFile query parameter." }, { status: 400 });
  }

  try {
    const payload = getNextActionRows(contextFile);
    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof WorkspaceFileError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.message,
            path: error.path,
          },
        },
        { status: error.status },
      );
    }

    return NextResponse.json(
      {
        error: {
          code: "UNKNOWN_ERROR",
          message: "Unexpected error while loading next-action rows.",
        },
      },
      { status: 500 },
    );
  }
}
