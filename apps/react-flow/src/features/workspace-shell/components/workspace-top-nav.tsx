"use client";

import Link from "next/link";
import { Moon, Sun } from "lucide-react";

import type { WorkspaceView } from "@/features/workspace-shell/model/workspace-view";
import { Button } from "@/shared/ui/button";

interface WorkspaceTopNavProps {
  currentView: WorkspaceView;
  themeMode: "light" | "dark";
  onToggleTheme: () => void;
}

function viewHref(view: WorkspaceView): string {
  return view === "context" ? "/" : `/?view=${view}`;
}

export function WorkspaceTopNav({ currentView, themeMode, onToggleTheme }: WorkspaceTopNavProps) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-border/70 bg-card/40 px-4">
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

      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-9 w-9 px-0"
        onClick={onToggleTheme}
        aria-label={themeMode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
        title={themeMode === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      >
        {themeMode === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
      </Button>
    </header>
  );
}
