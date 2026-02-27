import { Handle, Position, type NodeProps } from "@xyflow/react";
import { GitBranch, MessageSquare } from "lucide-react";

import { GraphNodeAccent, GraphNodeTemplate } from "@/shared/ui/graph-node-template";

interface ForkSessionNodeData {
  title: string;
  shortId: string;
  isRoot: boolean;
  updatedLabel: string;
}

export function ForkSessionNode({ data }: NodeProps) {
  const nodeData = data as unknown as ForkSessionNodeData;

  return (
    <>
      <Handle type="target" id="fork-in" position={Position.Left} className="!h-2.5 !w-2.5 !border-0 !bg-primary/70 !opacity-0" />
      <GraphNodeTemplate className="px-3 py-2">
        <div className="flex h-full items-center gap-3">
          <GraphNodeAccent />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 min-w-9 items-center justify-center rounded border border-border/80 bg-background/60 px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground">
                {nodeData.isRoot ? "root" : "fork"}
              </span>
              <p className="truncate text-sm font-medium text-foreground" title={nodeData.title}>
                {nodeData.title}
              </p>
            </div>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground" title={nodeData.shortId}>
              <span className="inline-flex items-center gap-1">
                <GitBranch className="h-3.5 w-3.5" />
                <span>{nodeData.shortId}</span>
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{nodeData.updatedLabel}</span>
              </span>
            </div>
          </div>
        </div>
      </GraphNodeTemplate>
      <Handle type="source" id="fork-out" position={Position.Right} className="!h-2.5 !w-2.5 !border-0 !bg-primary/70 !opacity-0" />
    </>
  );
}
