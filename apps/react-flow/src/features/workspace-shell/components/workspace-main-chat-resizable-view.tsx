"use client";

import { useEffect, useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

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
import { Skeleton } from "@/shared/ui/skeleton";

interface WorkspaceMainChatResizableViewProps {
  currentView: WorkspaceView;
  graphData: ContextGraphData;
  edgeMapping: ContextEdgeMapping;
  themeMode: "light" | "dark";
  selectedWorkflowInvocation: WorkflowInvocationSummary | null;
}

export function WorkspaceMainChatResizableView({
  currentView,
  graphData,
  edgeMapping,
  themeMode,
  selectedWorkflowInvocation,
}: WorkspaceMainChatResizableViewProps) {
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [initialChatPanelSize, setInitialChatPanelSize] = useState<number | null>(null);

  useEffect(() => {
    const collapsedStored = window.localStorage.getItem("workspace.chat.collapsed");
    if (collapsedStored === "1") {
      setIsChatCollapsed(true);
    }

    const stored = window.localStorage.getItem("workspace.chat.size");
    if (!stored) {
      setInitialChatPanelSize(32);
      return;
    }

    const parsed = Number.parseFloat(stored);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 100) {
      setInitialChatPanelSize(32);
      return;
    }

    setInitialChatPanelSize(parsed);
  }, []);

  if (initialChatPanelSize === null) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center">
        <div className="w-[260px] rounded-lg border border-border/70 bg-card/40 p-4">
          <Skeleton className="mb-3 h-4 w-24" />
          <Skeleton className="mb-2 h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      </div>
    );
  }

  const mainContent = (
    <section className="h-full min-w-0">
      <div className={currentView === "context" ? "h-full" : "hidden h-full"}>
        <ContextGraphCanvas graphData={graphData} edgeMapping={edgeMapping} themeMode={themeMode} />
      </div>
      <div className={currentView === "forks" ? "h-full" : "hidden h-full"}>
        <OpencodeForkGraphCanvas />
      </div>
      <div className={currentView === "chats" ? "flex h-full items-center justify-center text-sm text-muted-foreground" : "hidden"}>
        Chats view coming soon.
      </div>
      <div className={currentView === "workflows" ? "h-full" : "hidden h-full"}>
        <WorkflowsView selectedInvocation={selectedWorkflowInvocation} />
      </div>
    </section>
  );

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
