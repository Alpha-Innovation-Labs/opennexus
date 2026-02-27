"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { WorkflowsSidebar } from "@/features/workspace-shell/components/workflows-sidebar";
import type { WorkflowInvocationSummary } from "@/features/workspace-shell/model/workflow-invocation";
import type { WorkspaceView } from "@/features/workspace-shell/model/workspace-view";
import { Button } from "@/shared/ui/button";

interface WorkspaceLeftSidebarProps {
  collapsed: boolean;
  activeView: WorkspaceView;
  selectedWorkflowInvocation: WorkflowInvocationSummary | null;
  onSelectWorkflowInvocation: (invocation: WorkflowInvocationSummary) => void;
  onToggle: () => void;
}

export function WorkspaceLeftSidebar({
  collapsed,
  activeView,
  selectedWorkflowInvocation,
  onSelectWorkflowInvocation,
  onToggle,
}: WorkspaceLeftSidebarProps) {
  return (
    <aside
      data-testid="workspace-left-sidebar"
      className={`flex h-full flex-col border-r border-border/70 bg-card/60 ${collapsed ? "w-14 min-w-14" : "w-[248px] min-w-[248px]"}`}
    >
      <div className="flex h-14 items-center border-b border-border/70 px-4">
        {collapsed ? (
          <Button type="button" size="sm" className="h-8 w-8 px-0" variant="ghost" aria-label="Expand sidebar" onClick={onToggle}>
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
        ) : (
          <div className="flex w-full items-center justify-between">
            <div className="rounded-md border border-border/70 bg-background/80 px-2 py-1 text-xs font-semibold tracking-wide text-foreground">
              Nexus
            </div>
            <Button type="button" size="sm" className="h-8 w-8 px-0" variant="ghost" aria-label="Collapse sidebar" onClick={onToggle}>
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1">
        {!collapsed && activeView === "workflows" ? (
          <WorkflowsSidebar
            selectedInvocationId={selectedWorkflowInvocation?.invocationId ?? null}
            onSelectInvocation={onSelectWorkflowInvocation}
          />
        ) : null}
      </div>
    </aside>
  );
}
