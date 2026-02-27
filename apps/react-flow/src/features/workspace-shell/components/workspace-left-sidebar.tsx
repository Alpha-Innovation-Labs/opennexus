"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { listConversations, readCachedConversations } from "@/features/llm-conversation/lib/llm-chat-client";
import { WorkflowsSidebar } from "@/features/workspace-shell/components/workflows-sidebar";
import type { WorkflowInvocationSummary } from "@/features/workspace-shell/model/workflow-invocation";
import type { WorkspaceView } from "@/features/workspace-shell/model/workspace-view";
import { ScrollArea } from "@/shared/ui/scroll-area";

interface WorkspaceLeftSidebarProps {
  collapsed: boolean;
  activityCollapsed: boolean;
  activeView: WorkspaceView;
  selectedChatConversationId: string | null;
  selectedWorkflowInvocation: WorkflowInvocationSummary | null;
  onSelectChatConversation: (conversationId: string) => void;
  onSelectWorkflowInvocation: (invocation: WorkflowInvocationSummary) => void;
}

function ChatsSidebar({
  selectedConversationId,
  onSelectConversation,
}: {
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
}) {
  const [cachedConversations, setCachedConversations] = useState<ReturnType<typeof readCachedConversations>>([]);

  const { data: conversationsData = [], error } = useQuery({
    queryKey: ["opencode", "conversations"],
    queryFn: listConversations,
    staleTime: 0,
  });

  const conversations = conversationsData.length > 0 ? conversationsData : cachedConversations;

  useEffect(() => {
    const cached = readCachedConversations();
    if (cached.length > 0) {
      setCachedConversations(cached);
    }
  }, []);

  const groupedConversations = useMemo(() => {
    const now = new Date();
    const groups: Array<{ key: string; label: string; items: typeof conversations }> = [];

    const labelForDate = (value: number) => {
      const date = new Date(value);
      const isToday =
        date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();

      if (isToday) {
        return "Today";
      }

      const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
      const month = new Intl.DateTimeFormat(undefined, { month: "short" }).format(date);
      const day = new Intl.DateTimeFormat(undefined, { day: "numeric" }).format(date);
      return `${weekday} ${month} ${day}`;
    };

    for (const conversation of conversations) {
      const date = new Date(conversation.updatedAt);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const last = groups[groups.length - 1];

      if (!last || last.key !== key) {
        groups.push({ key, label: labelForDate(conversation.updatedAt), items: [conversation] });
      } else {
        last.items.push(conversation);
      }
    }

    return groups;
  }, [conversations]);

  const formatConversationTime = (value: number): string => {
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(value));
  };

  useEffect(() => {
    if (selectedConversationId || conversations.length === 0) {
      return;
    }

    onSelectConversation(conversations[0].id);
  }, [conversations, onSelectConversation, selectedConversationId]);

  if (error) {
    return <p className="px-3 py-2 text-xs text-destructive">{error instanceof Error ? error.message : "Unable to load chats"}</p>;
  }

  return (
    <div className="min-h-0 min-w-0 w-full flex-1 p-2">
      <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Chats</p>
      <div className="w-full max-w-full space-y-3 pr-2">
        {groupedConversations.map((group) => (
          <div key={group.key} className="space-y-1">
            <p className="sticky top-0 z-10 -ml-1 bg-card/90 px-1 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground backdrop-blur supports-[backdrop-filter]:bg-card/65">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((conversation) => (
                <li key={conversation.id} className="w-full max-w-full">
                  <button
                    type="button"
                    onClick={() => onSelectConversation(conversation.id)}
                    className={`grid w-full max-w-full cursor-pointer grid-cols-[1fr_auto] items-center gap-2 rounded-md px-2 py-2 text-left text-xs text-foreground transition-colors ${
                      selectedConversationId === conversation.id ? "bg-muted/85" : "hover:bg-background/35"
                    }`}
                    title={conversation.title || conversation.id}
                  >
                    <span className="block min-w-0 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[14px] leading-5">
                      {conversation.title || conversation.id}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                      {formatConversationTime(conversation.updatedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function ContextSidebar({ activeView }: { activeView: WorkspaceView }) {
  return (
    <div className="min-h-0 flex-1 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {activeView === "context" ? "Context" : "Forks"}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Use this panel for view-specific items. Context and Forks currently render their main content in the center canvas.
      </p>
    </div>
  );
}

export function WorkspaceLeftSidebar({
  collapsed,
  activityCollapsed,
  activeView,
  selectedChatConversationId,
  selectedWorkflowInvocation,
  onSelectChatConversation,
  onSelectWorkflowInvocation,
}: WorkspaceLeftSidebarProps) {
  return (
    <aside
      data-testid="workspace-left-sidebar"
      className={`h-full border-r border-border/70 bg-card ${collapsed ? "w-0 min-w-0 overflow-hidden" : "w-[280px] min-w-[280px]"}`}
    >
      {!collapsed ? (
        <ScrollArea className="h-full w-full overflow-x-hidden">
          <div className="flex min-h-full min-w-0 w-full flex-col">
            {activeView === "workflows" && !activityCollapsed ? (
              <WorkflowsSidebar
                selectedInvocationId={selectedWorkflowInvocation?.invocationId ?? null}
                onSelectInvocation={onSelectWorkflowInvocation}
              />
            ) : null}
            {activeView === "chats" && !activityCollapsed ? (
              <ChatsSidebar selectedConversationId={selectedChatConversationId} onSelectConversation={onSelectChatConversation} />
            ) : null}
            {(activeView === "context" || activeView === "forks") && !activityCollapsed ? (
              <ContextSidebar activeView={activeView} />
            ) : null}
          </div>
        </ScrollArea>
      ) : null}
    </aside>
  );
}
