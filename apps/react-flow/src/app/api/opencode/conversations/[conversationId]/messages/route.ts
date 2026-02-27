import { NextResponse } from "next/server";

import { listConversationMessages, streamConversationMessage } from "@/features/opencode-panel/server/opencode-conversation-service";

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

  const encoder = new TextEncoder();

  try {
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const enqueue = (event: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        };

        try {
          const replyStream = await streamConversationMessage(conversationId, message, request.signal);
          for await (const event of replyStream) {
            if (event.type === "delta" && typeof event.text === "string") {
              enqueue({ type: "delta", text: event.text });
              continue;
            }

            if (event.type === "tool" && event.toolCall) {
              enqueue({ type: "tool", toolCall: event.toolCall });
              continue;
            }

            if (event.type === "error") {
              enqueue({ type: "error", message: event.message ?? "Failed to stream OpenCode reply" });
              break;
            }

            if (event.type === "done") {
              enqueue({ type: "done" });
              break;
            }
          }
        } catch (error) {
          const detail = error instanceof Error ? error.message : "unknown_error";
          enqueue({ type: "error", message: `Unable to stream OpenCode response: ${detail}` });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown_error";
    return NextResponse.json(
      {
        error: {
          category: "opencode_prompt_failed",
          message: `Unable to start OpenCode streaming response: ${detail}`,
        },
      },
      { status: 502 },
    );
  }
}
