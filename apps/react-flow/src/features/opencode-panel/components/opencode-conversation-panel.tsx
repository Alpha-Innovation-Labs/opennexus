"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, MessageSquarePlus, SendHorizontal } from "lucide-react";

import { Button } from "@/shared/ui/button";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
}

function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function OpencodeConversationPanel() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canSend = draft.trim().length > 0 && !isSending;

  const loadConversations = useCallback(async () => {
    const response = await fetch("/api/opencode/conversations", { method: "GET" });
    const payload = (await response.json()) as {
      conversations?: ConversationSummary[];
      error?: { message?: string };
    };

    if (!response.ok || !Array.isArray(payload.conversations)) {
      throw new Error(payload.error?.message ?? "Failed to load conversations");
    }

    setConversations(payload.conversations);
    return payload.conversations;
  }, []);

  const loadConversationMessages = useCallback(async (targetConversationId: string) => {
    const response = await fetch(`/api/opencode/conversations/${targetConversationId}/messages`, {
      method: "GET",
    });

    const payload = (await response.json()) as {
      messages?: ChatMessage[];
      error?: { message?: string };
    };

    if (!response.ok || !Array.isArray(payload.messages)) {
      throw new Error(payload.error?.message ?? "Failed to load conversation messages");
    }

    setMessages(payload.messages);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const loaded = await loadConversations();
        if (cancelled || loaded.length === 0) {
          return;
        }

        const latest = loaded[0];
        if (!latest) {
          return;
        }

        setConversationId(latest.id);
        await loadConversationMessages(latest.id);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to initialize OpenCode panel");
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [loadConversations, loadConversationMessages]);

  const subtitle = useMemo(() => {
    if (!conversationId) {
      return "No active conversation";
    }

    const activeConversation = conversations.find((item) => item.id === conversationId);
    if (!activeConversation) {
      return `Conversation ${conversationId.slice(0, 8)}`;
    }

    return activeConversation.title;
  }, [conversationId, conversations]);

  const startNewConversation = async () => {
    setErrorMessage(null);
    setIsSending(true);
    try {
      const response = await fetch("/api/opencode/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const payload = (await response.json()) as { id?: string; error?: { message?: string } };
      if (!response.ok || !payload.id) {
        throw new Error(payload.error?.message ?? "Failed to start conversation");
      }

      setConversationId(payload.id);
      setMessages([]);
      const loaded = await loadConversations();
      if (loaded.length > 0) {
        const createdConversation = loaded.find((item) => item.id === payload.id);
        if (createdConversation) {
          setConversationId(createdConversation.id);
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to start conversation");
    } finally {
      setIsSending(false);
    }
  };

  const sendMessage = async () => {
    const nextDraft = draft.trim();
    if (!nextDraft) {
      return;
    }

    setErrorMessage(null);
    setDraft("");
    setIsSending(true);

    let activeConversationId = conversationId;

    try {
      if (!activeConversationId) {
        const createResponse = await fetch("/api/opencode/conversations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        });

        const createPayload = (await createResponse.json()) as { id?: string; error?: { message?: string } };
        if (!createResponse.ok || !createPayload.id) {
          throw new Error(createPayload.error?.message ?? "Failed to start conversation");
        }

        activeConversationId = createPayload.id;
        setConversationId(createPayload.id);
      }

      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: "user",
        content: nextDraft,
      };

      setMessages((current) => [...current, userMessage]);

      const replyResponse = await fetch(`/api/opencode/conversations/${activeConversationId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: nextDraft }),
      });

      const replyPayload = (await replyResponse.json()) as { text?: string; error?: { message?: string } };
      if (!replyResponse.ok || typeof replyPayload.text !== "string") {
        throw new Error(replyPayload.error?.message ?? "Failed to get OpenCode reply");
      }

      const assistantMessage: ChatMessage = {
        id: createMessageId(),
        role: "assistant",
        content: replyPayload.text.length > 0 ? replyPayload.text : "(No text response)",
      };

      setMessages((current) => [...current, assistantMessage]);
      await loadConversations();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-l border-border/80 bg-card/70 p-3">
      <div className="rounded-xl border border-border/70 bg-background/45 p-3">
        <div className="flex items-start gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-background/65 text-primary">
            <Bot className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">OpenCode Assistant</p>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={startNewConversation} disabled={isSending}>
            <MessageSquarePlus className="h-3.5 w-3.5" />
            New
          </Button>
        </div>
        <div className="mt-2">
          <label className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Conversations</label>
          <select
            value={conversationId ?? ""}
            onChange={(event) => {
              const nextConversationId = event.target.value;
              if (!nextConversationId) {
                setConversationId(null);
                setMessages([]);
                return;
              }

              setConversationId(nextConversationId);
              setErrorMessage(null);
              void loadConversationMessages(nextConversationId).catch((error) => {
                setErrorMessage(error instanceof Error ? error.message : "Failed to load conversation messages");
              });
            }}
            className="h-8 w-full rounded-lg border border-border/70 bg-background/70 px-2 text-xs text-foreground"
          >
            <option value="">Select conversation</option>
            {conversations.map((conversation) => (
              <option key={conversation.id} value={conversation.id}>
                {conversation.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto rounded-xl border border-border/70 bg-background/35 p-3">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Start a conversation and ask OpenCode about this project.</p>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "border-primary/45 bg-primary/10 text-foreground"
                    : "border-border/70 bg-card/90 text-card-foreground"
                }`}
              >
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{message.role}</p>
                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 rounded-xl border border-border/70 bg-background/45 p-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Ask OpenCode..."
          className="h-24 w-full resize-none rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/70"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (canSend) {
                void sendMessage();
              }
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Enter to send, Shift+Enter for new line</p>
          <Button type="button" size="sm" onClick={sendMessage} disabled={!canSend}>
            <SendHorizontal className="h-3.5 w-3.5" />
            Send
          </Button>
        </div>
        {errorMessage ? <p className="mt-2 text-xs text-amber-300">{errorMessage}</p> : null}
      </div>
    </aside>
  );
}
