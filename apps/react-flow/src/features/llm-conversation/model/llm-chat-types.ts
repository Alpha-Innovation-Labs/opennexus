export interface ChatToolCall {
  id: string;
  callId: string;
  tool: string;
  status: "pending" | "running" | "completed" | "error" | "unknown";
  title?: string;
  input?: string;
  output?: string;
  error?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: ChatToolCall[];
  createdAt?: number;
}

export interface StreamEvent {
  type: "delta" | "tool" | "done" | "error";
  text?: string;
  toolCall?: ChatToolCall;
  message?: string;
}

export interface CreatedConversation {
  id: string;
  title: string;
}

export function upsertToolCall(toolCalls: ChatToolCall[], toolCall: ChatToolCall): ChatToolCall[] {
  const existingIndex = toolCalls.findIndex((entry) => entry.callId === toolCall.callId);
  if (existingIndex < 0) {
    return [...toolCalls, toolCall];
  }

  const next = [...toolCalls];
  next[existingIndex] = toolCall;
  return next;
}

export function cloneMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    ...message,
    toolCalls: [...message.toolCalls],
  }));
}
