import type { NodeProps } from "@xyflow/react";
import { Bot, FileText } from "lucide-react";

import type { SubprojectTagNodeData } from "@/features/context-graph/services/context-graph-layout-service";

export function SubprojectTagNode({ data }: NodeProps) {
  const nodeData = data as SubprojectTagNodeData;

  return (
    <div className="h-full w-full rounded-lg border border-border/80 bg-card/90 px-3 py-2 text-card-foreground">
      <div className="flex h-full items-center gap-3">
        <span className="h-9 w-0.5 rounded bg-primary/90" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 min-w-8 items-center justify-center rounded border border-border/80 bg-background/60 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
              {nodeData.shortTag}
            </span>
            <p className="truncate text-sm font-medium text-foreground" title={nodeData.label}>
              {nodeData.label}
            </p>
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground" title={nodeData.label}>
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              <span>{nodeData.contextCount}</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <Bot className="h-3.5 w-3.5" />
              <span>{nodeData.adapterContextCount}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
