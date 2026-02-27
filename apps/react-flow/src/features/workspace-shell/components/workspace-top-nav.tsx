"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Moon, PanelLeftClose, PanelLeftOpen, Sun } from "lucide-react";

import type { WorkspaceView } from "@/features/workspace-shell/model/workspace-view";
import { Button } from "@/shared/ui/button";

interface WorkspaceTopNavProps {
  currentView: WorkspaceView;
  sidebarCollapsed: boolean;
  activityCollapsed: boolean;
  themeMode: "light" | "dark";
  themeVariant: "current" | "tui";
  onToggleSidebar: () => void;
  onToggleActivity: () => void;
  onThemeVariantChange: (variant: "current" | "tui") => void;
  onToggleTheme: () => void;
}

function viewHref(view: WorkspaceView): string {
  return `/${view}`;
}

export function WorkspaceTopNav({
  currentView,
  sidebarCollapsed,
  activityCollapsed,
  themeMode,
  themeVariant,
  onToggleSidebar,
  onToggleActivity,
  onThemeVariantChange,
  onToggleTheme,
}: WorkspaceTopNavProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const effectiveThemeMode = isMounted ? themeMode : "dark";

  return (
    <header className="flex h-14 items-center justify-between border-b border-border/70 bg-card/40 px-4">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9 w-9 px-0"
          aria-label="Toggle Sidebar"
          title="Toggle Sidebar"
          onClick={onToggleSidebar}
        >
          {sidebarCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>

        <nav className="flex items-center gap-2">
        {(["context", "forks", "chats", "workflows"] as WorkspaceView[]).map((view) => (
          <Link
            key={view}
            href={viewHref(view)}
            className={`rounded-md px-3 py-1.5 text-sm capitalize transition-colors ${
              currentView === view ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {view}
          </Link>
        ))}
        </nav>
      </div>

      <div className="flex items-center gap-1">
        <select
          value={themeVariant}
          onChange={(event) => onThemeVariantChange(event.target.value === "tui" ? "tui" : "current")}
          className="h-9 rounded-md border border-border/70 bg-background/70 px-2 text-xs text-foreground"
          aria-label="Select theme variant"
          title="Select theme variant"
        >
          <option value="current">Current Theme</option>
          <option value="tui">TUI Theme</option>
        </select>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9 px-2 text-xs"
          onClick={onToggleActivity}
          aria-label="Collapse activity"
          title="Collapse activity"
        >
          {activityCollapsed ? "Expand activity" : "Collapse activity"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-9 w-9 px-0"
          onClick={onToggleTheme}
          aria-label={effectiveThemeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={effectiveThemeMode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
        >
          {effectiveThemeMode === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </header>
  );
}
