import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ConversationMessagePayload,
  readCachedConversationMessages,
  createConversationSession,
  createMessageId,
  listConversationMessages,
  streamConversationReply,
  writeCachedConversationMessages,
} from "@/features/llm-conversation/lib/llm-chat-client";
import { type ChatMessage, upsertToolCall } from "@/features/llm-conversation/model/llm-chat-types";

type UseLlmConversationOptions = {
  conversationId: string | null;
  initialMessages?: ChatMessage[];
  onConversationIdChange?: (conversationId: string) => void;
  onActivity?: () => void;
};

const EMPTY_MESSAGES: ChatMessage[] = [];

export function useLlmConversation(options: UseLlmConversationOptions) {
  const { conversationId, initialMessages = EMPTY_MESSAGES, onConversationIdChange, onActivity } = options;
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const streamingRef = useRef(false);

  const normalizeApiMessages = useCallback(
    (payload: ConversationMessagePayload[]): ChatMessage[] => {
      return payload.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        toolCalls: Array.isArray(message.toolCalls) ? message.toolCalls : [],
        createdAt: typeof message.createdAt === "number" ? message.createdAt : undefined,
      }));
    },
    [],
  );

  const reload = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }

    setIsRefreshing(true);
    try {
      const payload = await listConversationMessages(conversationId);
      const normalized = normalizeApiMessages(payload);
      setMessages(normalized);
      writeCachedConversationMessages(conversationId, payload);
    } finally {
      setIsRefreshing(false);
    }
  }, [conversationId, normalizeApiMessages]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!conversationId) {
        setMessages(initialMessages);
        setErrorMessage(null);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      const cachedMessages = readCachedConversationMessages(conversationId);
      if (cachedMessages.length > 0) {
        setMessages(normalizeApiMessages(cachedMessages));
        setIsLoading(false);
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      try {
        const payload = await listConversationMessages(conversationId);
        if (!cancelled) {
          const normalized = normalizeApiMessages(payload);
          setMessages(normalized);
          writeCachedConversationMessages(conversationId, payload);
          setErrorMessage(null);
          setIsRefreshing(false);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load conversation messages");
          setIsRefreshing(false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [conversationId, initialMessages, normalizeApiMessages]);

  const sendMessage = useCallback(
    async (prompt: string) => {
      const text = prompt.trim();
      if (!text || isSending) {
        return;
      }

      setErrorMessage(null);
      setIsSending(true);
      streamingRef.current = true;

      let activeConversationId = conversationId;

      try {
        if (!activeConversationId) {
          const createdConversation = await createConversationSession();
          activeConversationId = createdConversation.id;
          onConversationIdChange?.(createdConversation.id);
        }

        const userMessage: ChatMessage = {
          id: createMessageId(),
          role: "user",
          content: text,
          toolCalls: [],
          createdAt: Date.now(),
        };

        const assistantMessageId = createMessageId();

        setMessages((current) => [
          ...current,
          userMessage,
          {
            id: assistantMessageId,
            role: "assistant",
            content: "",
            toolCalls: [],
            createdAt: Date.now(),
          },
        ]);

        const streamResult = await streamConversationReply(activeConversationId, text, {
          onDelta: (delta) => {
            setMessages((current) =>
              current.map((entry) =>
                entry.id === assistantMessageId
                  ? {
                      ...entry,
                      content: `${entry.content}${delta}`,
                    }
                  : entry,
              ),
            );
          },
          onTool: (toolCall) => {
            setMessages((current) =>
              current.map((entry) =>
                entry.id === assistantMessageId
                  ? {
                      ...entry,
                      toolCalls: upsertToolCall(entry.toolCalls, toolCall),
                    }
                  : entry,
              ),
            );
          },
        });

        if (!streamResult.receivedVisibleEvent) {
          setMessages((current) =>
            current.map((entry) =>
              entry.id === assistantMessageId
                ? {
                    ...entry,
                    content: "(No text response)",
                  }
                : entry,
            ),
          );
        }

        await reload();
        onActivity?.();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to send message");
      } finally {
        streamingRef.current = false;
        setIsSending(false);
        setIsRefreshing(false);
      }
    },
    [conversationId, isSending, onActivity, onConversationIdChange, reload],
  );

  return useMemo(
    () => ({
      messages,
      isLoading,
      isRefreshing,
      isSending,
      errorMessage,
      sendMessage,
      reload,
      setMessages,
    }),
    [errorMessage, isLoading, isRefreshing, isSending, messages, reload, sendMessage],
  );
}
