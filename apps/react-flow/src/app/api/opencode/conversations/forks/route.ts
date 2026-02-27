import { NextResponse } from "next/server";

import { listForkConversations } from "@/features/opencode-panel/server/opencode-conversation-service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const conversations = await listForkConversations();
    return NextResponse.json({ conversations }, { status: 200 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      {
        error: {
          category: "opencode_fork_list_failed",
          message: `Unable to list forked OpenCode conversations: ${detail}`,
        },
      },
      { status: 502 },
    );
  }
}
