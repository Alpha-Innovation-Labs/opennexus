"use client";

import { useState } from "react";

import type { ContextEdgeMapping } from "@/features/context-graph/model/context-graph-edges";
import type { ContextGraphData } from "@/features/context-graph/model/context-graph-types";
import { ContextGraphCanvas } from "@/features/context-graph/components/context-graph-canvas";
import { OpencodeForkGraphCanvas } from "@/features/opencode-panel/components/opencode-fork-graph-canvas";

interface ContextGraphTabsProps {
  graphData: ContextGraphData;
  edgeMapping: ContextEdgeMapping;
}

type GraphTab = "projects" | "forks";

export function ContextGraphTabs({ graphData, edgeMapping }: ContextGraphTabsProps) {
  const [activeTab, setActiveTab] = useState<GraphTab>("projects");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border/70 bg-card/70 px-3 py-2">
        <button
          type="button"
          onClick={() => setActiveTab("projects")}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
            activeTab === "projects"
              ? "border-primary/70 bg-primary/15 text-foreground"
              : "border-border/70 bg-card/60 text-muted-foreground hover:text-foreground"
          }`}
          data-testid="graph-tab-projects"
        >
          Projects
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("forks")}
          className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
            activeTab === "forks"
              ? "border-primary/70 bg-primary/15 text-foreground"
              : "border-border/70 bg-card/60 text-muted-foreground hover:text-foreground"
          }`}
          data-testid="graph-tab-forks"
        >
          Forks
        </button>
      </div>

      <div className="min-h-0 flex-1">
        {activeTab === "projects" ? (
          <ContextGraphCanvas graphData={graphData} edgeMapping={edgeMapping} />
        ) : (
          <OpencodeForkGraphCanvas />
        )}
      </div>
    </div>
  );
}
