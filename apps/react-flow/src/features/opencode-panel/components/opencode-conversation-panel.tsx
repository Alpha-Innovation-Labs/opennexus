"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bot, MessageSquarePlus, SendHorizontal } from "lucide-react";

import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent } from "@/shared/ui/dialog";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: ChatToolCall[];
}

interface ChatToolCall {
  id: string;
  callId: string;
  tool: string;
  status: "pending" | "running" | "completed" | "error" | "unknown";
  title?: string;
  input?: string;
  output?: string;
  error?: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
}

interface StreamEvent {
  type: "delta" | "tool" | "done" | "error";
  text?: string;
  toolCall?: ChatToolCall;
  message?: string;
}

interface OpencodeConversationPanelProps {
  className?: string;
  autoStartNewConversation?: boolean;
  disableShortcutModal?: boolean;
}

interface CreatedConversation {
  id: string;
  title: string;
}

function createMessageId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
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

function upsertToolCall(toolCalls: ChatToolCall[], toolCall: ChatToolCall): ChatToolCall[] {
  const existingIndex = toolCalls.findIndex((entry) => entry.callId === toolCall.callId);
  if (existingIndex < 0) {
    return [...toolCalls, toolCall];
  }

  const next = [...toolCalls];
  next[existingIndex] = toolCall;
  return next;
}

function toolStatusLabel(status: ChatToolCall["status"]): string {
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

async function createConversationSession(title?: string): Promise<CreatedConversation> {
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

async function streamConversationReply(
  conversationId: string,
  message: string,
  onDelta: (delta: string) => void,
): Promise<{ receivedDelta: boolean }> {
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
  let receivedDelta = false;
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
        receivedDelta = true;
        onDelta(event.text);
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
      receivedDelta = true;
      onDelta(event.text);
      continue;
    }

    if (event.type === "error") {
      throw new Error(event.message ?? "OpenCode stream failed");
    }
  }

  if (!receivedDelta) {
    const recoveryResponse = await fetch(`/api/opencode/conversations/${conversationId}/messages`, {
      method: "GET",
    });

    const recoveryPayload = (await recoveryResponse.json().catch(() => ({}))) as {
      messages?: ChatMessage[];
    };

    if (recoveryResponse.ok && Array.isArray(recoveryPayload.messages)) {
      const lastAssistantMessage = [...recoveryPayload.messages]
        .reverse()
        .find((entry) => entry.role === "assistant" && entry.content.trim().length > 0);

      if (lastAssistantMessage) {
        onDelta(lastAssistantMessage.content);
        receivedDelta = true;
      }
    }
  }

  return { receivedDelta };
}

interface DualLane {
  id: "left" | "right";
  label: string;
  conversationId: string | null;
  messages: ChatMessage[];
  errorMessage: string | null;
}

function OpencodeDualChatModal() {
  const [lanes, setLanes] = useState<DualLane[]>([
    { id: "left", label: "Chat A", conversationId: null, messages: [], errorMessage: null },
    { id: "right", label: "Chat B", conversationId: null, messages: [], errorMessage: null },
  ]);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [globalErrorMessage, setGlobalErrorMessage] = useState<string | null>(null);

  const canSend = draft.trim().length > 0 && !isSending;

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const [leftConversation, rightConversation] = await Promise.all([
          createConversationSession(),
          createConversationSession(),
        ]);

        if (cancelled) {
          return;
        }

        setLanes((current) =>
          current.map((lane) => {
            if (lane.id === "left") {
              return {
                ...lane,
                conversationId: leftConversation.id,
                label: leftConversation.title,
              };
            }

            return {
              ...lane,
              conversationId: rightConversation.id,
              label: rightConversation.title,
            };
          }),
        );
      } catch (error) {
        if (!cancelled) {
          setGlobalErrorMessage(error instanceof Error ? error.message : "Failed to start dual chats");
        }
      } finally {
        if (!cancelled) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const sendToBoth = async () => {
    const prompt = draft.trim();
    if (!prompt || isSending) {
      return;
    }

    setDraft("");
    setIsSending(true);
    setGlobalErrorMessage(null);
    setLanes((current) => current.map((lane) => ({ ...lane, errorMessage: null })));

    try {
      const ensuredConversationIds = await Promise.all(
        lanes.map(async (lane) => {
          if (lane.conversationId) {
            return lane.conversationId;
          }

          const created = await createConversationSession();
          setLanes((current) =>
            current.map((item) =>
              item.id === lane.id
                ? {
                    ...item,
                    conversationId: created.id,
                    label: created.title,
                  }
                : item,
            ),
          );
          return created.id;
        }),
      );

      const assistantMessageIds = lanes.map(() => createMessageId());
      setLanes((current) =>
        current.map((lane, laneIndex) => ({
          ...lane,
          messages: [
            ...lane.messages,
            { id: createMessageId(), role: "user", content: prompt, toolCalls: [] },
            { id: assistantMessageIds[laneIndex] ?? createMessageId(), role: "assistant", content: "", toolCalls: [] },
          ],
        })),
      );

      const streamResults = await Promise.allSettled(
        ensuredConversationIds.map((conversationId, laneIndex) =>
          streamConversationReply(conversationId, prompt, (delta) => {
            setLanes((current) =>
              current.map((lane, laneCursor) =>
                laneCursor === laneIndex
                  ? {
                      ...lane,
                      messages: lane.messages.map((message) =>
                        message.id === assistantMessageIds[laneIndex]
                          ? { ...message, content: `${message.content}${delta}` }
                          : message,
                      ),
                    }
                  : lane,
              ),
            );
          }),
        ),
      );

      streamResults.forEach((result, laneIndex) => {
        if (result.status === "fulfilled") {
          if (result.value.receivedDelta) {
            return;
          }

          setLanes((current) =>
            current.map((lane, laneCursor) =>
              laneCursor === laneIndex
                ? {
                    ...lane,
                    messages: lane.messages.map((message) =>
                      message.id === assistantMessageIds[laneIndex] ? { ...message, content: "(No text response)" } : message,
                    ),
                  }
                : lane,
            ),
          );
          return;
        }

        const detail = result.reason instanceof Error ? result.reason.message : "Failed to send message";
        setLanes((current) =>
          current.map((lane, laneCursor) =>
            laneCursor === laneIndex
              ? {
                  ...lane,
                  errorMessage: detail,
                  messages: lane.messages.map((message) =>
                    message.id === assistantMessageIds[laneIndex] ? { ...message, content: "(Error)" } : message,
                  ),
                }
              : lane,
          ),
        );
      });
    } catch (error) {
      setGlobalErrorMessage(error instanceof Error ? error.message : "Failed to send to both chats");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Parallel chats</p>
          <p className="text-xs text-muted-foreground">One prompt, two chats in parallel.</p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2">
        {lanes.map((lane) => (
          <section key={lane.id} className="flex min-h-0 flex-col rounded-xl border border-border/70 bg-background/35 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border/70 bg-background/65 text-primary">
                <Bot className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{lane.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {lane.conversationId ? `Conversation ${lane.conversationId.slice(0, 8)}` : "Starting..."}
                </p>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border/70 bg-card/90 p-3">
              {lane.messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">{isBootstrapping ? "Starting chat..." : "Send a prompt to both chats."}</p>
              ) : (
                <div className="space-y-3">
                  {lane.messages.map((message) => (
                    <div
                      key={message.id}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-sm",
                        message.role === "user"
                          ? "border-primary/45 bg-primary/10 text-foreground"
                          : "border-border/70 bg-card text-card-foreground",
                      )}
                    >
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{message.role}</p>
                      <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {lane.errorMessage ? <p className="mt-2 text-xs text-amber-300">{lane.errorMessage}</p> : null}
          </section>
        ))}
      </div>

      <div className="mt-3 rounded-xl border border-border/70 bg-background/45 p-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Send one prompt to both chats..."
          className="h-20 w-full resize-none rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/70"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (canSend) {
                void sendToBoth();
              }
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Enter to send to both, Shift+Enter for new line</p>
          <Button type="button" size="sm" onClick={sendToBoth} disabled={!canSend || isBootstrapping}>
            <SendHorizontal className="h-3.5 w-3.5" />
            Send to both
          </Button>
        </div>
        {globalErrorMessage ? <p className="mt-2 text-xs text-amber-300">{globalErrorMessage}</p> : null}
      </div>
    </div>
  );
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
    if (disableShortcutModal) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "n") {
        event.preventDefault();
        setShortcutModalSeed((current) => current + 1);
        setIsShortcutModalOpen(true);
        return;
      }

      if (key === "a") {
        event.preventDefault();
        setParallelModalSeed((current) => current + 1);
        setIsParallelModalOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [disableShortcutModal]);

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

      const replyResponse = await fetch(`/api/opencode/conversations/${activeConversationId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({ message: nextDraft }),
      });

      if (!replyResponse.ok || !replyResponse.body) {
        const replyPayload = (await replyResponse.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(replyPayload.error?.message ?? "Failed to get OpenCode reply stream");
      }

      const reader = replyResponse.body.getReader();
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
            setMessages((current) =>
              current.map((entry) =>
                entry.id === assistantMessageId
                  ? {
                      ...entry,
                      content: `${entry.content}${event.text ?? ""}`,
                    }
                  : entry,
              ),
            );
            continue;
          }

          if (event.type === "tool" && event.toolCall) {
            receivedVisibleEvent = true;
            setMessages((current) =>
              current.map((entry) =>
                entry.id === assistantMessageId
                  ? {
                      ...entry,
                      toolCalls: upsertToolCall(entry.toolCalls, event.toolCall as ChatToolCall),
                    }
                  : entry,
              ),
            );
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
          setMessages((current) =>
            current.map((entry) =>
              entry.id === assistantMessageId
                ? {
                    ...entry,
                    content: `${entry.content}${event.text ?? ""}`,
                  }
                : entry,
            ),
          );
          continue;
        }

        if (event.type === "tool" && event.toolCall) {
          receivedVisibleEvent = true;
          setMessages((current) =>
            current.map((entry) =>
              entry.id === assistantMessageId
                ? {
                    ...entry,
                    toolCalls: upsertToolCall(entry.toolCalls, event.toolCall as ChatToolCall),
                  }
                : entry,
            ),
          );
          continue;
        }

        if (event.type === "error") {
          throw new Error(event.message ?? "OpenCode stream failed");
        }
      }

      if (!receivedVisibleEvent) {
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
          <Button data-testid="opencode-send" type="button" size="sm" onClick={sendMessage} disabled={!canSend}>
            <SendHorizontal className="h-3.5 w-3.5" />
            Send
          </Button>
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
        </>
      )}
    </>
  );
}
