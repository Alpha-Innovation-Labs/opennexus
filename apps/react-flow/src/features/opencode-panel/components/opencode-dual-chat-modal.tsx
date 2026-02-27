"use client";

import { useEffect, useState } from "react";
import { Bot, GitFork, SendHorizontal } from "lucide-react";

import { createConversationSession, createMessageId, forkConversationSession, streamConversationReply } from "@/features/opencode-panel/lib/chat-client";
import { cloneMessages, type ChatMessage, type ForkSeed } from "@/features/opencode-panel/model/chat-types";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";

interface LaneState {
  id: string;
  label: string;
  conversationId: string | null;
  messages: ChatMessage[];
  forkOriginMessageId: string | null;
  draft: string;
  isSending: boolean;
  errorMessage: string | null;
}

interface OpencodeDualChatModalProps {
  forkSeed?: ForkSeed;
}

function makeLaneId(): string {
  return `lane-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

export function OpencodeDualChatModal({ forkSeed }: OpencodeDualChatModalProps) {
  const [lanes, setLanes] = useState<LaneState[]>(
    forkSeed
      ? [
          {
            id: "left",
            label: forkSeed.sourceTitle,
            conversationId: forkSeed.sourceConversationId,
            messages: cloneMessages(forkSeed.sourceMessages),
            forkOriginMessageId: null,
            draft: "",
            isSending: false,
            errorMessage: null,
          },
          {
            id: "right",
            label: "Forking...",
            conversationId: null,
            messages: cloneMessages(forkSeed.sourceMessages),
            forkOriginMessageId: null,
            draft: "",
            isSending: false,
            errorMessage: null,
          },
        ]
      : [
          {
            id: "left",
            label: "Chat A",
            conversationId: null,
            messages: [],
            forkOriginMessageId: null,
            draft: "",
            isSending: false,
            errorMessage: null,
          },
          {
            id: "right",
            label: "Chat B",
            conversationId: null,
            messages: [],
            forkOriginMessageId: null,
            draft: "",
            isSending: false,
            errorMessage: null,
          },
        ],
  );
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [globalErrorMessage, setGlobalErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        if (forkSeed) {
          const forkedConversation = await forkConversationSession(forkSeed.sourceConversationId);
          if (cancelled) {
            return;
          }

          setLanes((current) =>
            current.map((lane) =>
              lane.id === "right"
                ? {
                    ...lane,
                    conversationId: forkedConversation.id,
                    label: forkedConversation.title,
                  }
                : lane,
            ),
          );
          return;
        }

        const [leftConversation, rightConversation] = await Promise.all([createConversationSession(), createConversationSession()]);

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

            if (lane.id === "right") {
              return {
                ...lane,
                conversationId: rightConversation.id,
                label: rightConversation.title,
              };
            }

            return lane;
          }),
        );
      } catch (error) {
        if (!cancelled) {
          setGlobalErrorMessage(error instanceof Error ? error.message : "Failed to start chat lanes");
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
  }, [forkSeed]);

  const sendToLane = async (laneId: string) => {
    const lane = lanes.find((entry) => entry.id === laneId);
    if (!lane) {
      return;
    }

    const prompt = lane.draft.trim();
    if (!prompt || lane.isSending) {
      return;
    }

    setGlobalErrorMessage(null);
    setLanes((current) =>
      current.map((entry) =>
        entry.id === laneId
          ? {
              ...entry,
              draft: "",
              isSending: true,
              errorMessage: null,
            }
          : entry,
      ),
    );

    try {
      let conversationId = lane.conversationId;
      if (!conversationId) {
        const created = await createConversationSession();
        conversationId = created.id;
        setLanes((current) =>
          current.map((entry) =>
            entry.id === laneId
              ? {
                  ...entry,
                  conversationId: created.id,
                  label: created.title,
                }
              : entry,
          ),
        );
      }

      const assistantMessageId = createMessageId();
      setLanes((current) =>
        current.map((entry) =>
          entry.id === laneId
            ? {
                ...entry,
                messages: [
                  ...entry.messages,
                  { id: createMessageId(), role: "user", content: prompt, toolCalls: [] },
                  { id: assistantMessageId, role: "assistant", content: "", toolCalls: [] },
                ],
              }
            : entry,
        ),
      );

      const streamResult = await streamConversationReply(conversationId, prompt, {
        onDelta: (delta) => {
          setLanes((current) =>
            current.map((entry) =>
              entry.id === laneId
                ? {
                    ...entry,
                    messages: entry.messages.map((message) =>
                      message.id === assistantMessageId
                        ? {
                            ...message,
                            content: `${message.content}${delta}`,
                          }
                        : message,
                    ),
                  }
                : entry,
            ),
          );
        },
      });

      if (!streamResult.receivedVisibleEvent) {
        setLanes((current) =>
          current.map((entry) =>
            entry.id === laneId
              ? {
                  ...entry,
                  messages: entry.messages.map((message) =>
                    message.id === assistantMessageId ? { ...message, content: "(No text response)" } : message,
                  ),
                }
              : entry,
          ),
        );
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Failed to send message";
      setLanes((current) =>
        current.map((entry) =>
          entry.id === laneId
            ? {
                ...entry,
                errorMessage: detail,
              }
            : entry,
        ),
      );
    } finally {
      setLanes((current) =>
        current.map((entry) =>
          entry.id === laneId
            ? {
                ...entry,
                isSending: false,
              }
            : entry,
        ),
      );
    }
  };

  const forkLane = async (laneId: string, sourceMessageId?: string) => {
    const source = lanes.find((entry) => entry.id === laneId);
    if (!source?.conversationId) {
      setGlobalErrorMessage("Wait for this lane to finish starting before creating a new fork.");
      return;
    }

    setGlobalErrorMessage(null);
    try {
      const forkedConversation = await forkConversationSession(source.conversationId, sourceMessageId);
      const boundaryIndex = sourceMessageId ? source.messages.findIndex((message) => message.id === sourceMessageId) : -1;
      const includeUntil =
        boundaryIndex >= 0
          ? source.messages[boundaryIndex + 1]?.role === "assistant"
            ? boundaryIndex + 2
            : boundaryIndex + 1
          : source.messages.length;

      const seedMessages = source.messages.slice(0, includeUntil);
      const nextLane: LaneState = {
        id: makeLaneId(),
        label: forkedConversation.title,
        conversationId: forkedConversation.id,
        messages: cloneMessages(seedMessages),
        forkOriginMessageId: sourceMessageId ?? null,
        draft: "",
        isSending: false,
        errorMessage: null,
      };

      setLanes((current) => [...current, nextLane]);
    } catch (error) {
      setGlobalErrorMessage(error instanceof Error ? error.message : "Failed to fork lane");
    }
  };

  return (
    <div data-testid="opencode-dual-chat-modal" className="flex h-full min-h-0 flex-col bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Forked chats</p>
          <p className="text-xs text-muted-foreground">Each lane is independent. You can fork any lane again.</p>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {lanes.map((lane) => {
          const canSend = lane.draft.trim().length > 0 && !lane.isSending;

          return (
            <section
              key={lane.id}
              data-testid={`opencode-dual-lane-${lane.id}`}
              className="flex min-h-0 flex-col rounded-xl border border-border/70 bg-background/35 p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
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
                <span className="text-[11px] text-muted-foreground">Fork from a user message below</span>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-border/70 bg-card/90 p-3">
                {lane.messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {isBootstrapping ? "Starting chat..." : "Send a message in this lane to continue this branch."}
                  </p>
                ) : (
                  <div className="space-y-3">
                    {lane.messages.map((message) => (
                      <div
                        key={message.id}
                        className={cn(
                          "rounded-xl border px-3 py-2 text-sm",
                          message.id === lane.forkOriginMessageId ? "border-lime-400/70 bg-lime-500/10" : "",
                          message.role === "user"
                            ? "border-primary/45 bg-primary/10 text-foreground"
                            : "border-border/70 bg-card text-card-foreground",
                        )}
                      >
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{message.role}</p>
                        {message.id === lane.forkOriginMessageId ? (
                          <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-lime-300">Fork origin</p>
                        ) : null}
                        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        {message.role === "user" ? (
                          <div className="mt-2 flex justify-end">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              data-testid={`opencode-message-fork-${lane.id}-${message.id}`}
                              onClick={() => {
                                void forkLane(lane.id, message.id);
                              }}
                              disabled={!lane.conversationId}
                            >
                              <GitFork className="h-3.5 w-3.5" />
                              Fork from here
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-2 rounded-lg border border-border/70 bg-background/55 p-2">
                <textarea
                  data-testid={`opencode-lane-draft-${lane.id}`}
                  value={lane.draft}
                  onChange={(event) => {
                    const nextDraft = event.target.value;
                    setLanes((current) =>
                      current.map((entry) =>
                        entry.id === lane.id
                          ? {
                              ...entry,
                              draft: nextDraft,
                            }
                          : entry,
                      ),
                    );
                  }}
                  placeholder="Continue this branch..."
                  className="h-20 w-full resize-none rounded-lg border border-border/70 bg-background/70 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary/70"
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      if (canSend) {
                        void sendToLane(lane.id);
                      }
                    }
                  }}
                />
                <div className="mt-2 flex items-center justify-end gap-2">
                  <Button
                    data-testid={`opencode-lane-send-${lane.id}`}
                    type="button"
                    size="sm"
                    onClick={() => {
                      void sendToLane(lane.id);
                    }}
                    disabled={!canSend}
                  >
                    <SendHorizontal className="h-3.5 w-3.5" />
                    Send
                  </Button>
                </div>
              </div>

              {lane.errorMessage ? <p className="mt-2 text-xs text-amber-300">{lane.errorMessage}</p> : null}
            </section>
          );
        })}
      </div>

      {globalErrorMessage ? <p className="mt-3 text-xs text-amber-300">{globalErrorMessage}</p> : null}
    </div>
  );
}
