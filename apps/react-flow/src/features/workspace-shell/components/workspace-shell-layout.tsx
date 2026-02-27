"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import type { ContextEdgeMapping } from "@/features/context-graph/model/context-graph-edges";
import type { ContextGraphData } from "@/features/context-graph/model/context-graph-types";
import { WorkspaceLeftSidebar } from "@/features/workspace-shell/components/workspace-left-sidebar";
import { WorkspaceMainChatResizableView } from "@/features/workspace-shell/components/workspace-main-chat-resizable-view";
import { WorkspaceTopNav } from "@/features/workspace-shell/components/workspace-top-nav";
import type { WorkflowInvocationSummary } from "@/features/workspace-shell/model/workflow-invocation";
import type { WorkspaceView } from "@/features/workspace-shell/model/workspace-view";

interface WorkspaceShellLayoutProps {
  activeView: WorkspaceView;
  graphData: ContextGraphData;
  edgeMapping: ContextEdgeMapping;
  initialSelectedChatConversationId?: string | null;
}

const SIDEBAR_KEY = "workspace.sidebar.collapsed";
const ACTIVITY_KEY = "workspace.sidebar.activity.collapsed";
const THEME_KEY = "workspace.theme";
const THEME_VARIANT_KEY = "workspace.theme.variant";

type ThemeMode = "light" | "dark";
type ThemeVariant = "current" | "tui";

export function WorkspaceShellLayout({
  activeView,
  graphData,
  edgeMapping,
  initialSelectedChatConversationId = null,
}: WorkspaceShellLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isActivityCollapsed, setIsActivityCollapsed] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("dark");
  const [themeVariant, setThemeVariant] = useState<ThemeVariant>("tui");
  const [selectedChatConversationId, setSelectedChatConversationId] = useState<string | null>(initialSelectedChatConversationId);
  const [selectedWorkflowInvocation, setSelectedWorkflowInvocation] = useState<WorkflowInvocationSummary | null>(null);

  const handleSelectChatConversation = (conversationId: string | null) => {
    setSelectedChatConversationId(conversationId);
    if (conversationId) {
      router.push(`/chats/${conversationId}`);
      return;
    }
    router.push("/chats");
  };

  useEffect(() => {
    setSelectedChatConversationId(initialSelectedChatConversationId);
  }, [initialSelectedChatConversationId]);

  useEffect(() => {
    if (activeView !== "chats") {
      return;
    }

    const match = pathname.match(/^\/chats\/([^/?#]+)$/);
    if (!match) {
      setSelectedChatConversationId(null);
      return;
    }

    const conversationIdFromPath = decodeURIComponent(match[1]);
    setSelectedChatConversationId(conversationIdFromPath);
  }, [activeView, pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", themeMode === "dark");
    window.localStorage.setItem(THEME_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    document.documentElement.dataset.themeVariant = themeVariant;
    window.localStorage.setItem(THEME_VARIANT_KEY, themeVariant);
  }, [themeVariant]);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_KEY);
    if (stored === "1") {
      setIsSidebarCollapsed(true);
    }

    const activityStored = window.localStorage.getItem(ACTIVITY_KEY);
    if (activityStored === "1") {
      setIsActivityCollapsed(true);
    }

    const themeModeStored = window.localStorage.getItem(THEME_KEY);
    if (themeModeStored === "light" || themeModeStored === "dark") {
      setThemeMode(themeModeStored);
    } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setThemeMode("dark");
    } else {
      setThemeMode("light");
    }

    const themeVariantStored = window.localStorage.getItem(THEME_VARIANT_KEY);
    if (themeVariantStored === "current" || themeVariantStored === "tui") {
      setThemeVariant(themeVariantStored);
    } else {
      setThemeVariant("tui");
    }
  }, []);

  const toggleSidebar = () => {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 bg-background">
      <WorkspaceLeftSidebar
        collapsed={isSidebarCollapsed}
        activityCollapsed={isActivityCollapsed}
        activeView={activeView}
        selectedChatConversationId={selectedChatConversationId}
        selectedWorkflowInvocation={selectedWorkflowInvocation}
        onSelectChatConversation={(conversationId) => handleSelectChatConversation(conversationId)}
        onSelectWorkflowInvocation={setSelectedWorkflowInvocation}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-border/70 bg-card/35">
        <WorkspaceTopNav
          currentView={activeView}
          sidebarCollapsed={isSidebarCollapsed}
          activityCollapsed={isActivityCollapsed}
          themeMode={themeMode}
          themeVariant={themeVariant}
          onToggleSidebar={toggleSidebar}
          onToggleActivity={() => {
            setIsActivityCollapsed((current) => {
              const next = !current;
              window.localStorage.setItem(ACTIVITY_KEY, next ? "1" : "0");
              return next;
            });
          }}
          onThemeVariantChange={setThemeVariant}
          onToggleTheme={() => setThemeMode((current) => (current === "dark" ? "light" : "dark"))}
        />

        <div className="min-h-0 flex-1">
              <WorkspaceMainChatResizableView
                currentView={activeView}
                graphData={graphData}
                edgeMapping={edgeMapping}
                themeMode={themeMode}
                selectedChatConversationId={selectedChatConversationId}
                onSelectChatConversation={handleSelectChatConversation}
                selectedWorkflowInvocation={selectedWorkflowInvocation}
              />
        </div>
        </div>
      </div>
    </div>
  );
}
