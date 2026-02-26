import { NextResponse } from "next/server";

import { createConversation, listConversations } from "@/features/opencode-panel/server/opencode-conversation-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const conversations = await listConversations();
    return NextResponse.json({ conversations }, { status: 200 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      {
        error: {
          category: "opencode_list_failed",
          message: `Unable to list OpenCode conversations: ${detail}`,
        },
      },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { title?: string };
    const title = typeof body.title === "string" && body.title.trim().length > 0 ? body.title.trim() : undefined;

    const conversation = await createConversation(title);
    return NextResponse.json(conversation, { status: 200 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      {
        error: {
          category: "opencode_create_failed",
          message: `Unable to start a new OpenCode conversation: ${detail}`,
        },
      },
      { status: 502 },
    );
  }
}
