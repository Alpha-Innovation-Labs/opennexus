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
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
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

export interface ForkSeed {
  sourceConversationId: string;
  sourceTitle: string;
  sourceMessages: ChatMessage[];
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

export function toolStatusLabel(status: ChatToolCall["status"]): string {
  if (status === "pending") {
    return "Pending";
  }
  if (status === "running") {
    return "Running";
  }
  if (status === "completed") {
    return "Completed";
  }
  if (status === "error") {
    return "Error";
  }
  return "Unknown";
}

export function cloneMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    ...message,
    toolCalls: [...message.toolCalls],
  }));
}
