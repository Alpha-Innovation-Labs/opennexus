import { NextResponse } from "next/server";

import { listConversationMessages, sendConversationMessage } from "@/features/opencode-panel/server/opencode-conversation-service";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

export async function GET(_: Request, context: RouteContext) {
  const { conversationId } = await context.params;

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
    const messages = await listConversationMessages(conversationId);
    return NextResponse.json({ messages }, { status: 200 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      {
        error: {
          category: "opencode_messages_failed",
          message: `Unable to read OpenCode conversation messages: ${detail}`,
        },
      },
      { status: 502 },
    );
  }
}

export async function POST(request: Request, context: RouteContext) {
  const { conversationId } = await context.params;
  const payload = (await request.json().catch(() => ({}))) as { message?: string };
  const message = typeof payload.message === "string" ? payload.message.trim() : "";

  if (!conversationId || message.length === 0) {
    return NextResponse.json(
      {
        error: {
          category: "invalid_request",
          message: "Conversation id and non-empty message are required.",
        },
      },
      { status: 400 },
    );
  }

  try {
    const response = await sendConversationMessage(conversationId, message);
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      {
        error: {
          category: "opencode_prompt_failed",
          message: `Unable to get a response from OpenCode: ${detail}`,
        },
      },
      { status: 502 },
    );
  }
}
