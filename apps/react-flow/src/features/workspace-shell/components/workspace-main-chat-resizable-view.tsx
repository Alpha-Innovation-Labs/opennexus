"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { PanelRightClose, PanelRightOpen, Plus } from "lucide-react";

import { ContextGraphCanvas } from "@/features/context-graph/components/context-graph-canvas";
import type { ContextEdgeMapping } from "@/features/context-graph/model/context-graph-edges";
import type { ContextGraphData } from "@/features/context-graph/model/context-graph-types";
import { OpencodeForkGraphCanvas } from "@/features/opencode-panel/components/opencode-fork-graph-canvas";
import { OpencodeConversationPanel } from "@/features/opencode-panel/components/opencode-conversation-panel";
import { WorkflowsView } from "@/features/workspace-shell/components/workflows-view";
import type { WorkflowInvocationSummary } from "@/features/workspace-shell/model/workflow-invocation";
import type { WorkspaceView } from "@/features/workspace-shell/model/workspace-view";
import { Button } from "@/shared/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/shared/ui/resizable";

const MAIN_CHAT_LAYOUT_KEY = "workspace.main.chats.layout";
const MAIN_CHAT_LINKED_PANE_ID = "workspace-main-chat-pane-linked";
const MAIN_CHAT_MAX_PANES = 6;
const MAIN_CHAT_MAX_VERTICAL_WIDTH = 400;
const MAIN_CHAT_MIN_HORIZONTAL_WIDTH = 260;

type MainChatPane = {
  id: string;
  kind: "linked" | "independent";
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function parseStoredChatPanelSize(stored: string | null): number {
  if (!stored) {
    return 32;
  }

  const parsed = Number.parseFloat(stored);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 100) {
    return 32;
  }

  return parsed;
}

function normalizeMainChatPanes(next: MainChatPane[]): MainChatPane[] {
  const deduped = next.filter((pane, index) => next.findIndex((candidate) => candidate.id === pane.id) === index);
  const withKnownKinds = deduped.filter((pane) => pane.kind === "linked" || pane.kind === "independent");
  const limited = withKnownKinds.slice(0, MAIN_CHAT_MAX_PANES);

  const hasLinkedPane = limited.some((pane) => pane.kind === "linked");
  if (hasLinkedPane && limited.length > 0) {
    return limited;
  }

  return [{ id: MAIN_CHAT_LINKED_PANE_ID, kind: "linked" }];
}

function loadMainChatPanes(): MainChatPane[] {
  if (!isBrowser()) {
    return [{ id: MAIN_CHAT_LINKED_PANE_ID, kind: "linked" }];
  }

  const stored = window.localStorage.getItem(MAIN_CHAT_LAYOUT_KEY);
  if (!stored) {
    return [{ id: MAIN_CHAT_LINKED_PANE_ID, kind: "linked" }];
  }

  try {
    const parsed = JSON.parse(stored) as unknown;
    if (!Array.isArray(parsed)) {
      return [{ id: MAIN_CHAT_LINKED_PANE_ID, kind: "linked" }];
    }

    const panes = parsed
      .map((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          return null;
        }

        const candidate = entry as { id?: unknown; kind?: unknown };
        if (typeof candidate.id !== "string") {
          return null;
        }

        const kind = candidate.kind === "independent" ? "independent" : candidate.kind === "linked" ? "linked" : null;
        if (!kind) {
          return null;
        }

        return { id: candidate.id, kind } as MainChatPane;
      })
      .filter((entry): entry is MainChatPane => entry !== null);

    return normalizeMainChatPanes(panes);
  } catch {
    return [{ id: MAIN_CHAT_LINKED_PANE_ID, kind: "linked" }];
  }
}

interface WorkspaceMainChatResizableViewProps {
  currentView: WorkspaceView;
  graphData: ContextGraphData;
  edgeMapping: ContextEdgeMapping;
  themeMode: "light" | "dark";
  selectedChatConversationId: string | null;
  onSelectChatConversation: (conversationId: string | null) => void;
  selectedWorkflowInvocation: WorkflowInvocationSummary | null;
}

function ChatsCenterView({
  conversationId,
  onSelectConversation,
}: {
  conversationId: string | null;
  onSelectConversation: (conversationId: string | null) => void;
}) {
  return (
    <OpencodeConversationPanel
      className="h-full border-0 bg-background/35"
      disableShortcutModal
      activeConversationId={conversationId}
      onActiveConversationChange={onSelectConversation}
    />
  );
}

export function WorkspaceMainChatResizableView({
  currentView,
  graphData,
  edgeMapping,
  themeMode,
  selectedChatConversationId,
  onSelectChatConversation,
  selectedWorkflowInvocation,
}: WorkspaceMainChatResizableViewProps) {
  const [isChatCollapsed, setIsChatCollapsed] = useState(() => isBrowser() && window.localStorage.getItem("workspace.chat.collapsed") === "1");
  const [initialChatPanelSize, setInitialChatPanelSize] = useState<number>(() =>
    isBrowser() ? parseStoredChatPanelSize(window.localStorage.getItem("workspace.chat.size")) : 32,
  );
  const [chatMainPanes, setChatMainPanes] = useState<MainChatPane[]>(() => loadMainChatPanes());
  const [chatMainAutoStartPaneIds, setChatMainAutoStartPaneIds] = useState<Record<string, boolean>>({});
  const [draggedMainPaneId, setDraggedMainPaneId] = useState<string | null>(null);
  const [viewportWidth, setViewportWidth] = useState(() => (isBrowser() ? window.innerWidth : 0));

  const addMainChatSplitPane = useCallback(() => {
    setChatMainPanes((current) => {
      if (current.length >= MAIN_CHAT_MAX_PANES) {
        return current;
      }

      const nextPaneId = `workspace-main-chat-pane-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
      setChatMainAutoStartPaneIds((currentAutoStartPaneIds) => ({
        ...currentAutoStartPaneIds,
        [nextPaneId]: true,
      }));
      return [...current, { id: nextPaneId, kind: "independent" }];
    });
  }, []);

  const reorderMainChatPanes = useCallback((draggedPaneId: string, targetPaneId: string) => {
    if (draggedPaneId === targetPaneId) {
      return;
    }

    setChatMainPanes((current) => {
      const draggedIndex = current.findIndex((pane) => pane.id === draggedPaneId);
      const targetIndex = current.findIndex((pane) => pane.id === targetPaneId);
      if (draggedIndex < 0 || targetIndex < 0) {
        return current;
      }

      const next = [...current];
      const [draggedPane] = next.splice(draggedIndex, 1);
      if (!draggedPane) {
        return current;
      }
      next.splice(targetIndex, 0, draggedPane);
      return next;
    });
  }, []);

  const chatMainSplitOrientation = useMemo<"horizontal" | "vertical">(() => {
    if (chatMainPanes.length <= 1) {
      return "vertical";
    }

    if (viewportWidth <= 0) {
      return "vertical";
    }

    const widthPerHorizontalPane = viewportWidth / chatMainPanes.length;
    if (widthPerHorizontalPane > MAIN_CHAT_MAX_VERTICAL_WIDTH) {
      return "horizontal";
    }

    if (widthPerHorizontalPane < MAIN_CHAT_MIN_HORIZONTAL_WIDTH) {
      return "vertical";
    }

    return "horizontal";
  }, [chatMainPanes.length, viewportWidth]);

  useEffect(() => {
    const updateViewportSize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", updateViewportSize);
    return () => {
      window.removeEventListener("resize", updateViewportSize);
    };
  }, []);

  useEffect(() => {
    if (!isBrowser()) {
      return;
    }

    window.localStorage.setItem(MAIN_CHAT_LAYOUT_KEY, JSON.stringify(chatMainPanes));
  }, [chatMainPanes]);

  useEffect(() => {
    const handleSplitShortcut = (event: KeyboardEvent) => {
      if (currentView !== "chats" || isChatCollapsed || !(event.ctrlKey || event.metaKey)) {
        return;
      }

      if (event.repeat || event.key.toLowerCase() !== "n") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      addMainChatSplitPane();
    };

    window.addEventListener("keydown", handleSplitShortcut, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleSplitShortcut, { capture: true });
    };
  }, [addMainChatSplitPane, currentView, isChatCollapsed]);

  const mainContent = (
    <section className="h-full min-w-0">
      <div className={currentView === "context" ? "h-full" : "hidden h-full"}>
        <ContextGraphCanvas graphData={graphData} edgeMapping={edgeMapping} themeMode={themeMode} />
      </div>
      <div className={currentView === "forks" ? "h-full" : "hidden h-full"}>
        <OpencodeForkGraphCanvas />
      </div>
      {currentView === "chats" ? (
        <div className="relative h-full">
          <div className="absolute left-3 right-3 top-3 z-10 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
              {chatMainPanes.map((pane, paneIndex) => (
                <button
                  key={`workspace-main-chat-chip-${pane.id}`}
                  type="button"
                  draggable
                  onDragStart={() => {
                    setDraggedMainPaneId(pane.id);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggedMainPaneId) {
                      reorderMainChatPanes(draggedMainPaneId, pane.id);
                    }
                    setDraggedMainPaneId(null);
                  }}
                  onDragEnd={() => {
                    setDraggedMainPaneId(null);
                  }}
                  className="h-8 shrink-0 rounded-md border border-border/70 bg-background/85 px-2 text-xs text-foreground hover:bg-accent"
                  aria-label={`Reorder chat pane ${paneIndex + 1}`}
                  title="Drag to reorder"
                >
                  {pane.kind === "linked" ? `Chat ${paneIndex + 1} (linked)` : `Chat ${paneIndex + 1}`}
                </button>
              ))}
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 px-2"
              data-testid="workspace-main-chat-split"
              onClick={addMainChatSplitPane}
              aria-label="Split chats view"
              title="Split chat (Ctrl+N)"
              disabled={chatMainPanes.length >= MAIN_CHAT_MAX_PANES}
            >
              <Plus className="h-3.5 w-3.5" />
              Split
            </Button>
          </div>
          <ResizablePanelGroup
            orientation={chatMainSplitOrientation}
            className="h-full w-full"
          >
            {chatMainPanes.map((pane, paneIndex) => (
              <Fragment key={pane.id}>
                <ResizablePanel defaultSize={`${100 / chatMainPanes.length}%`}>
                  <section className="h-full min-h-0 min-w-0">
                    {pane.kind === "linked" ? (
                      <ChatsCenterView conversationId={selectedChatConversationId} onSelectConversation={onSelectChatConversation} />
                    ) : (
                      <OpencodeConversationPanel
                        disableShortcutModal
                        autoStartNewConversation={chatMainAutoStartPaneIds[pane.id] === true}
                        className="h-full border-0 bg-background/35"
                      />
                    )}
                  </section>
                </ResizablePanel>
                {paneIndex < chatMainPanes.length - 1 ? <ResizableHandle withHandle data-testid="workspace-main-chat-split-handle" /> : null}
              </Fragment>
            ))}
          </ResizablePanelGroup>
        </div>
      ) : null}
      <div className={currentView === "workflows" ? "h-full" : "hidden h-full"}>
        <WorkflowsView selectedInvocation={selectedWorkflowInvocation} />
      </div>
    </section>
  );

  if (currentView === "chats") {
    return <div className="h-full min-w-0">{mainContent}</div>;
  }

  if (isChatCollapsed) {
    return (
      <div className="relative h-full min-w-0">
        {mainContent}
        <div className="absolute right-3 top-3">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            data-testid="workspace-chat-expand"
            onClick={() => {
              const stored = window.localStorage.getItem("workspace.chat.size");
              if (stored) {
                const parsed = Number.parseFloat(stored);
                if (Number.isFinite(parsed) && parsed > 0 && parsed < 100) {
                  setInitialChatPanelSize(parsed);
                }
              }
              setIsChatCollapsed(false);
              window.localStorage.setItem("workspace.chat.collapsed", "0");
            }}
            aria-label="Expand chat sidebar"
          >
            <PanelRightOpen className="h-3.5 w-3.5" />
            Chat
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ResizablePanelGroup key={`chat-size-${initialChatPanelSize}`} orientation="horizontal">
      <ResizablePanel defaultSize={`${100 - initialChatPanelSize}%`}>
        {mainContent}
      </ResizablePanel>

      <ResizableHandle withHandle data-testid="chat-resize-handle" />

      <ResizablePanel
        key="main-chat-panel"
        defaultSize={`${initialChatPanelSize}%`}
        onResize={(panelSize) => {
          const nextSize = panelSize.asPercentage;
          if (!Number.isFinite(nextSize) || nextSize <= 0 || nextSize >= 100) {
            return;
          }

          window.localStorage.setItem("workspace.chat.size", String(nextSize));
        }}
      >
        <aside data-testid="workspace-right-sidebar" className="flex h-full min-h-0 w-full flex-col border-l border-border/70 bg-card/55">
          <div className="flex h-14 items-center justify-between border-b border-border/70 px-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Chat</p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 w-8 px-0"
              data-testid="workspace-chat-collapse"
              onClick={() => {
                setIsChatCollapsed(true);
                window.localStorage.setItem("workspace.chat.collapsed", "1");
              }}
              aria-label="Collapse chat sidebar"
            >
              <PanelRightClose className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-h-0 w-full flex-1">
            <section className="h-full min-w-0">
              <OpencodeConversationPanel />
            </section>
          </div>
        </aside>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
