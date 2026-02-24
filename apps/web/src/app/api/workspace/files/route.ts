import { NextResponse } from "next/server";

import { WorkspaceFileError, listWorkspaceFiles } from "@/features/workspace/server/context-workspace-files";

const workspaceErrorResponse = (error: unknown): NextResponse => {
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
        message: "Unexpected error while listing workspace markdown files.",
      },
    },
    { status: 500 },
  );
};

export async function GET(): Promise<NextResponse> {
  try {
    const files = listWorkspaceFiles();
    return NextResponse.json({ files });
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
