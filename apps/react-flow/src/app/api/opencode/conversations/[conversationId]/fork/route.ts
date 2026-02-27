import { NextResponse } from "next/server";

import { forkConversation } from "@/features/opencode-panel/server/opencode-conversation-service";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

export async function POST(request: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  const payload = (await request.json().catch(() => ({}))) as { upToMessageId?: string };
  const upToMessageId = typeof payload.upToMessageId === "string" && payload.upToMessageId.trim().length > 0 ? payload.upToMessageId.trim() : undefined;

  if (!conversationId) {
    return NextResponse.json(
      {
        error: {
          category: "invalid_request",
          message: "Conversation id is required.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const forkedConversation = await forkConversation(conversationId, upToMessageId);
    return NextResponse.json(forkedConversation, { status: 200 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      {
        error: {
          category: "opencode_fork_failed",
          message: `Unable to fork OpenCode conversation: ${detail}`,
        },
      },
      { status: 502 },
    );
  }
}
