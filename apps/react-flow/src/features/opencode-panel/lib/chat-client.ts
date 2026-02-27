import type { CreatedConversation, StreamEvent } from "@/features/opencode-panel/model/chat-types";

export function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export async function createConversationSession(title?: string): Promise<CreatedConversation> {
  const response = await fetch("/api/opencode/conversations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(title ? { title } : {}),
  });

  const payload = (await response.json().catch(() => ({}))) as { id?: string; title?: string; error?: { message?: string } };
  if (!response.ok || !payload.id) {
    throw new Error(payload.error?.message ?? "Failed to start conversation");
  }

  return {
    id: payload.id,
    title: payload.title ?? `Conversation ${payload.id.slice(0, 8)}`,
  };
}

export async function forkConversationSession(conversationId: string, upToMessageId?: string): Promise<CreatedConversation> {
  const response = await fetch(`/api/opencode/conversations/${conversationId}/fork`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(upToMessageId ? { upToMessageId } : {}),
  });

  const payload = (await response.json().catch(() => ({}))) as { id?: string; title?: string; error?: { message?: string } };
  if (!response.ok || !payload.id) {
    throw new Error(payload.error?.message ?? "Failed to fork conversation");
  }

  return {
    id: payload.id,
    title: payload.title ?? `Conversation ${payload.id.slice(0, 8)}`,
  };
}

function parseSsePayload(chunk: string): StreamEvent[] {
  const events: StreamEvent[] = [];
  const normalized = chunk.replace(/\r\n/g, "\n");
  const frames = normalized.split("\n\n");

  for (const frame of frames) {
    if (!frame.trim()) {
      continue;
    }

    const dataLines = frame
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart());

    if (dataLines.length === 0) {
      continue;
    }

    const raw = dataLines.join("\n");

    try {
      const parsed = JSON.parse(raw) as StreamEvent;
      if (parsed && (parsed.type === "delta" || parsed.type === "tool" || parsed.type === "done" || parsed.type === "error")) {
        events.push(parsed);
      }
    } catch {
      continue;
    }
  }

  return events;
}

export async function streamConversationReply(
  conversationId: string,
  message: string,
  handlers: {
    onDelta: (text: string) => void;
    onTool?: (toolCall: NonNullable<StreamEvent["toolCall"]>) => void;
  },
): Promise<{ receivedVisibleEvent: boolean }> {
  const response = await fetch(`/api/opencode/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({ message }),
  });

  if (!response.ok || !response.body) {
    const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(payload.error?.message ?? "Failed to get OpenCode reply stream");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let receivedVisibleEvent = false;
  let streamCompleted = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    const frameBoundary = buffer.lastIndexOf("\n\n");
    if (frameBoundary < 0) {
      continue;
    }

    const completeChunk = buffer.slice(0, frameBoundary);
    buffer = buffer.slice(frameBoundary + 2);

    const events = parseSsePayload(completeChunk);
    for (const event of events) {
      if (event.type === "delta" && typeof event.text === "string" && event.text.length > 0) {
        receivedVisibleEvent = true;
        handlers.onDelta(event.text);
        continue;
      }

      if (event.type === "tool" && event.toolCall && handlers.onTool) {
        receivedVisibleEvent = true;
        handlers.onTool(event.toolCall);
        continue;
      }

      if (event.type === "error") {
        throw new Error(event.message ?? "OpenCode stream failed");
      }

      if (event.type === "done") {
        streamCompleted = true;
        break;
      }
    }

    if (streamCompleted) {
      break;
    }
  }

  buffer += decoder.decode().replace(/\r\n/g, "\n");
  const tailEvents = parseSsePayload(buffer);
  for (const event of tailEvents) {
    if (event.type === "delta" && typeof event.text === "string" && event.text.length > 0) {
      receivedVisibleEvent = true;
      handlers.onDelta(event.text);
      continue;
    }

    if (event.type === "tool" && event.toolCall && handlers.onTool) {
      receivedVisibleEvent = true;
      handlers.onTool(event.toolCall);
      continue;
    }

    if (event.type === "error") {
      throw new Error(event.message ?? "OpenCode stream failed");
    }
  }

  if (!receivedVisibleEvent) {
    const recoveryResponse = await fetch(`/api/opencode/conversations/${conversationId}/messages`, {
      method: "GET",
    });

    const recoveryPayload = (await recoveryResponse.json().catch(() => ({}))) as {
      messages?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (recoveryResponse.ok && Array.isArray(recoveryPayload.messages)) {
      const lastAssistantMessage = [...recoveryPayload.messages]
        .reverse()
        .find((entry) => entry.role === "assistant" && entry.content.trim().length > 0);

      if (lastAssistantMessage) {
        handlers.onDelta(lastAssistantMessage.content);
        receivedVisibleEvent = true;
      }
    }
  }

  return { receivedVisibleEvent };
}
