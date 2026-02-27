"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, GitBranch, GitFork, MessageSquarePlus, SendHorizontal } from "lucide-react";

import { createConversationSession, createMessageId, streamConversationReply } from "@/features/opencode-panel/lib/chat-client";
import { OpencodeDualChatModal } from "@/features/opencode-panel/components/opencode-dual-chat-modal";
import { OpencodeForkGraphCanvas } from "@/features/opencode-panel/components/opencode-fork-graph-canvas";
import {
  cloneMessages,
  toolStatusLabel,
  type ChatMessage,
  type ChatToolCall,
  type ConversationSummary,
  type ForkSeed,
  upsertToolCall,
} from "@/features/opencode-panel/model/chat-types";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent } from "@/shared/ui/dialog";

interface OpencodeConversationPanelProps {
  className?: string;
  autoStartNewConversation?: boolean;
  disableShortcutModal?: boolean;
}

export function OpencodeConversationPanel({
  className,
  autoStartNewConversation = false,
  disableShortcutModal = false,
}: OpencodeConversationPanelProps) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);
  const [shortcutModalSeed, setShortcutModalSeed] = useState(0);
  const [isParallelModalOpen, setIsParallelModalOpen] = useState(false);
  const [parallelModalSeed, setParallelModalSeed] = useState(0);
  const [isForkModalOpen, setIsForkModalOpen] = useState(false);
  const [forkModalSeed, setForkModalSeed] = useState(0);
  const [forkSeed, setForkSeed] = useState<ForkSeed | null>(null);
  const [isForkGraphOpen, setIsForkGraphOpen] = useState(false);
  const lastShortcutAtRef = useRef(0);

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
      messages?: Array<{
        id: string;
        role: "user" | "assistant";
        content: string;
        toolCalls?: ChatToolCall[];
      }>;
      error?: { message?: string };
    };

    if (!response.ok || !Array.isArray(payload.messages)) {
      throw new Error(payload.error?.message ?? "Failed to load conversation messages");
    }

    setMessages(
      payload.messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        toolCalls: Array.isArray(message.toolCalls) ? message.toolCalls : [],
      })),
    );
  }, []);

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

  const openForkModal = useCallback(() => {
    if (!conversationId) {
      setErrorMessage("Start or select a conversation before forking.");
      return;
    }

    const activeConversation = conversations.find((entry) => entry.id === conversationId);
    setForkSeed({
      sourceConversationId: conversationId,
      sourceTitle: activeConversation?.title ?? `Conversation ${conversationId.slice(0, 8)}`,
      sourceMessages: cloneMessages(messages),
    });
    setForkModalSeed((current) => current + 1);
    setIsForkModalOpen(true);
  }, [conversationId, conversations, messages]);

  const startNewConversation = useCallback(async () => {
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
  }, [loadConversations]);

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

  useEffect(() => {
    if (!autoStartNewConversation) {
      return;
    }

    void startNewConversation();
  }, [autoStartNewConversation, startNewConversation]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      if (event.repeat) {
        return;
      }

      const now = Date.now();
      if (now - lastShortcutAtRef.current < 150) {
        return;
      }
      lastShortcutAtRef.current = now;

      const key = event.key.toLowerCase();
      if (key === "n" && !disableShortcutModal) {
        event.preventDefault();
        setShortcutModalSeed((current) => current + 1);
        setIsShortcutModalOpen(true);
        return;
      }

      if (key === "a" && !disableShortcutModal) {
        event.preventDefault();
        setParallelModalSeed((current) => current + 1);
        setIsParallelModalOpen(true);
        return;
      }

      if (key === "s") {
        event.preventDefault();
        openForkModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [disableShortcutModal, openForkModal]);

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
        const createdConversation = await createConversationSession();
        activeConversationId = createdConversation.id;
        setConversationId(createdConversation.id);
      }

      const userMessage: ChatMessage = {
        id: createMessageId(),
        role: "user",
        content: nextDraft,
        toolCalls: [],
      };

      setMessages((current) => [...current, userMessage]);

      const assistantMessageId = createMessageId();
      setMessages((current) => [
        ...current,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          toolCalls: [],
        },
      ]);

      const streamResult = await streamConversationReply(activeConversationId, nextDraft, {
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

      await loadConversations();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <aside
        data-testid="opencode-panel"
        className={cn("flex h-full min-h-0 w-full flex-col border-l border-border/80 bg-card/70 p-3", className)}
      >
      <div className="rounded-xl border border-border/70 bg-background/45 p-3">
        <div className="flex items-start gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-background/65 text-primary">
            <Bot className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">OpenCode Assistant</p>
            <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setIsForkGraphOpen(true)}>
              <GitBranch className="h-3.5 w-3.5" />
              Forks
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={startNewConversation} disabled={isSending}>
              <MessageSquarePlus className="h-3.5 w-3.5" />
              New
            </Button>
          </div>
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
                data-testid={`opencode-message-${message.role}`}
                className={`rounded-xl border px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "border-primary/45 bg-primary/10 text-foreground"
                    : "border-border/70 bg-card/90 text-card-foreground"
                }`}
              >
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{message.role}</p>
                <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                {message.toolCalls.length > 0 ? (
                  <div className="mt-2 space-y-2" data-testid="opencode-tool-calls">
                    {message.toolCalls.map((toolCall) => (
                      <details key={toolCall.callId} open className="rounded-lg border border-border/60 bg-background/55 p-2">
                        <summary className="cursor-pointer list-none text-xs font-medium text-foreground">
                          <span className="mr-2 rounded border border-border/70 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                            {toolStatusLabel(toolCall.status)}
                          </span>
                          {toolCall.title ?? toolCall.tool}
                        </summary>
                        <div className="mt-2 space-y-2 text-xs text-muted-foreground" data-testid="opencode-tool-call-item">
                          {toolCall.input ? (
                            <div>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em]">Input</p>
                              <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded border border-border/50 bg-background/70 p-2 text-[11px] text-foreground">
                                {toolCall.input}
                              </pre>
                            </div>
                          ) : null}
                          {toolCall.output ? (
                            <div>
                              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em]">Output</p>
                              <pre className="max-h-36 overflow-auto whitespace-pre-wrap rounded border border-border/50 bg-background/70 p-2 text-[11px] text-foreground">
                                {toolCall.output}
                              </pre>
                            </div>
                          ) : null}
                          {toolCall.error ? (
                            <p className="rounded border border-amber-500/40 bg-amber-500/10 p-2 text-amber-200">{toolCall.error}</p>
                          ) : null}
                        </div>
                      </details>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 rounded-xl border border-border/70 bg-background/45 p-3">
        <textarea
          data-testid="opencode-draft"
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
          <div className="flex items-center gap-2">
            <Button
              data-testid="opencode-fork"
              type="button"
              variant="secondary"
              size="sm"
              onClick={openForkModal}
              disabled={isSending}
            >
              <GitFork className="h-3.5 w-3.5" />
              Fork
            </Button>
            <Button data-testid="opencode-send" type="button" size="sm" onClick={sendMessage} disabled={!canSend}>
              <SendHorizontal className="h-3.5 w-3.5" />
              Send
            </Button>
          </div>
        </div>
        {errorMessage ? <p className="mt-2 text-xs text-amber-300">{errorMessage}</p> : null}
      </div>
      </aside>

      {disableShortcutModal ? null : (
        <>
          <Dialog open={isShortcutModalOpen} onOpenChange={setIsShortcutModalOpen}>
            <DialogContent className="h-[88vh] w-[84vw] max-w-[1300px] p-0">
              <OpencodeConversationPanel
                key={`shortcut-new-chat-${shortcutModalSeed}`}
                autoStartNewConversation
                disableShortcutModal
                className="h-full border-l-0 p-4"
              />
            </DialogContent>
          </Dialog>

          <Dialog open={isParallelModalOpen} onOpenChange={setIsParallelModalOpen}>
            <DialogContent className="h-[88vh] w-[92vw] max-w-[1500px] p-0">
              <OpencodeDualChatModal key={`shortcut-parallel-chat-${parallelModalSeed}`} />
            </DialogContent>
          </Dialog>

          <Dialog
            open={isForkModalOpen}
            onOpenChange={(open) => {
              setIsForkModalOpen(open);
              if (!open) {
                setForkSeed(null);
              }
            }}
          >
            <DialogContent className="h-[88vh] w-[92vw] max-w-[1500px] p-0">
              {forkSeed ? <OpencodeDualChatModal key={`shortcut-fork-chat-${forkModalSeed}`} forkSeed={forkSeed} /> : null}
            </DialogContent>
          </Dialog>

          <Dialog open={isForkGraphOpen} onOpenChange={setIsForkGraphOpen}>
            <DialogContent className="h-[88vh] w-[92vw] max-w-[1500px] p-0">
              <OpencodeForkGraphCanvas />
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  );
}
