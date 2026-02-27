"use client";

import { useEffect, useState } from "react";

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
}

const SIDEBAR_KEY = "workspace.sidebar.collapsed";
const THEME_KEY = "workspace.theme";

type ThemeMode = "light" | "dark";

function resolveInitialThemeMode(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function WorkspaceShellLayout({ activeView, graphData, edgeMapping }: WorkspaceShellLayoutProps) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>(resolveInitialThemeMode);
  const [selectedWorkflowInvocation, setSelectedWorkflowInvocation] = useState<WorkflowInvocationSummary | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", themeMode === "dark");
    window.localStorage.setItem(THEME_KEY, themeMode);
  }, [themeMode]);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_KEY);
    if (stored === "1") {
      setIsSidebarCollapsed(true);
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
    <div className="flex h-full min-h-0">
      <WorkspaceLeftSidebar
        collapsed={isSidebarCollapsed}
        activeView={activeView}
        selectedWorkflowInvocation={selectedWorkflowInvocation}
        onSelectWorkflowInvocation={setSelectedWorkflowInvocation}
        onToggle={toggleSidebar}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <WorkspaceTopNav
          currentView={activeView}
          themeMode={themeMode}
          onToggleTheme={() => setThemeMode((current) => (current === "dark" ? "light" : "dark"))}
        />

        <div className="min-h-0 flex-1">
          <WorkspaceMainChatResizableView
            currentView={activeView}
            graphData={graphData}
            edgeMapping={edgeMapping}
            themeMode={themeMode}
            selectedWorkflowInvocation={selectedWorkflowInvocation}
          />
        </div>
      </div>
    </div>
  );
}
