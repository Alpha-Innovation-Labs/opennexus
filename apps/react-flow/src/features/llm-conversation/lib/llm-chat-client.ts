import type { CreatedConversation, StreamEvent } from "@/features/llm-conversation/model/llm-chat-types";

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
}

export interface ConversationMessagePayload {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: number;
  toolCalls?: Array<{
    id: string;
    callId: string;
    tool: string;
    status: "pending" | "running" | "completed" | "error" | "unknown";
    title?: string;
    input?: string;
    output?: string;
    error?: string;
  }>;
}

const CONVERSATIONS_CACHE_KEY = "llm-conversation:list:v1";
const CONVERSATION_MESSAGES_CACHE_PREFIX = "llm-conversation:messages:v1:";

function getSessionStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function readCachedConversations(): ConversationSummary[] {
  const storage = getSessionStorage();
  if (!storage) {
    return [];
  }

  const raw = storage.getItem(CONVERSATIONS_CACHE_KEY);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (entry): entry is ConversationSummary =>
        Boolean(entry) &&
        typeof entry === "object" &&
        typeof (entry as ConversationSummary).id === "string" &&
        typeof (entry as ConversationSummary).title === "string" &&
        typeof (entry as ConversationSummary).updatedAt === "number",
    );
  } catch {
    return [];
  }
}

export function writeCachedConversations(conversations: ConversationSummary[]): void {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  storage.setItem(CONVERSATIONS_CACHE_KEY, JSON.stringify(conversations));
}

export function readCachedConversationMessages(conversationId: string): ConversationMessagePayload[] {
  const storage = getSessionStorage();
  if (!storage) {
    return [];
  }

  const raw = storage.getItem(`${CONVERSATION_MESSAGES_CACHE_PREFIX}${conversationId}`);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(
      (entry): entry is ConversationMessagePayload =>
        Boolean(entry) &&
        typeof entry === "object" &&
        typeof (entry as ConversationMessagePayload).id === "string" &&
        ((entry as ConversationMessagePayload).role === "user" || (entry as ConversationMessagePayload).role === "assistant") &&
        typeof (entry as ConversationMessagePayload).content === "string" &&
        ((entry as ConversationMessagePayload).createdAt === undefined || typeof (entry as ConversationMessagePayload).createdAt === "number"),
    );
  } catch {
    return [];
  }
}

export function writeCachedConversationMessages(conversationId: string, messages: ConversationMessagePayload[]): void {
  const storage = getSessionStorage();
  if (!storage) {
    return;
  }

  storage.setItem(`${CONVERSATION_MESSAGES_CACHE_PREFIX}${conversationId}`, JSON.stringify(messages));
}

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

export async function listConversations(): Promise<ConversationSummary[]> {
  const response = await fetch("/api/opencode/conversations", { method: "GET", cache: "no-store" });
  const payload = (await response.json().catch(() => ({}))) as {
    conversations?: ConversationSummary[];
    error?: { message?: string };
  };

  if (!response.ok || !Array.isArray(payload.conversations)) {
    throw new Error(payload.error?.message ?? "Failed to load conversations");
  }

  writeCachedConversations(payload.conversations);
  return payload.conversations;
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

export async function listConversationMessages(conversationId: string): Promise<ConversationMessagePayload[]> {
  const response = await fetch(`/api/opencode/conversations/${conversationId}/messages`, {
    method: "GET",
  });

  const payload = (await response.json().catch(() => ({}))) as {
    messages?: ConversationMessagePayload[];
    error?: { message?: string };
  };

  if (!response.ok || !Array.isArray(payload.messages)) {
    throw new Error(payload.error?.message ?? "Failed to load conversation messages");
  }

  writeCachedConversationMessages(conversationId, payload.messages);
  return payload.messages;
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
    const recovery = await listConversationMessages(conversationId);
    const lastAssistantMessage = [...recovery].reverse().find((entry) => entry.role === "assistant" && entry.content.trim().length > 0);
    if (lastAssistantMessage) {
      handlers.onDelta(lastAssistantMessage.content);
      receivedVisibleEvent = true;
    }
  }

  return { receivedVisibleEvent };
}
