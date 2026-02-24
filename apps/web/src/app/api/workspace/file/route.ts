import { NextRequest, NextResponse } from "next/server";

import {
  WorkspaceFileError,
  readWorkspaceFile,
  saveWorkspaceFile,
} from "@/features/workspace/server/context-workspace-files";

type SaveFileBody = {
  path?: unknown;
  content?: unknown;
  expectedMtimeMs?: unknown;
};

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
        message: "Unexpected error while processing workspace markdown file.",
      },
    },
    { status: 500 },
  );
};

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const filePath = request.nextUrl.searchParams.get("path");
    const payload = readWorkspaceFile(filePath);
    return NextResponse.json(payload);
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const body = ((await request.json().catch(() => ({}))) ?? {}) as SaveFileBody;

  if (typeof body.content !== "string") {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_REQUEST",
          message: "Markdown content must be provided as a string.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const saveInput: {
      path: unknown;
      content: string;
      expectedMtimeMs?: number;
    } = {
      path: body.path,
      content: body.content,
    };

    if (typeof body.expectedMtimeMs === "number" && Number.isFinite(body.expectedMtimeMs)) {
      saveInput.expectedMtimeMs = body.expectedMtimeMs;
    }

    const payload = saveWorkspaceFile(saveInput);
    return NextResponse.json(payload);
  } catch (error) {
    return workspaceErrorResponse(error);
  }
}
