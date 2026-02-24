import { NextResponse } from "next/server";

import { WorkspaceFileError } from "@/features/workspace/server/context-workspace-files";
import { getContextOptions } from "@/features/workspace/server/workspace-service";

export async function GET(): Promise<NextResponse> {
  try {
    return NextResponse.json({ contexts: getContextOptions() });
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
          message: "Unexpected error while loading context options.",
        },
      },
      { status: 500 },
    );
  }
}
