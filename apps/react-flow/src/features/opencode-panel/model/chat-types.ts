import type { ChatMessage } from "@/features/llm-conversation/model/llm-chat-types";

export type {
  ChatMessage,
  ChatToolCall,
  CreatedConversation,
  StreamEvent,
} from "@/features/llm-conversation/model/llm-chat-types";

export { cloneMessages, upsertToolCall } from "@/features/llm-conversation/model/llm-chat-types";

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
}

export interface ForkSeed {
  sourceConversationId: string;
  sourceTitle: string;
  sourceMessages: ChatMessage[];
}
