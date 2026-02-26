import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react";

import type { ProjectGroupNodeData } from "@/features/context-graph/services/context-graph-layout-service";
import { cn } from "@/shared/lib/cn";

export function ProjectGroupNode({ data, selected }: NodeProps) {
  const groupData = data as ProjectGroupNodeData;
  const projectName = groupData.projectName ?? groupData.groupId.split("/")[0] ?? groupData.groupId;
  const mode = groupData.interactionMode ?? "select";
  const titleLabel = groupData.groupKind === "project" ? projectName : groupData.label;
  const minWidth = Math.max(320, groupData.requiredWidth ?? 320);
  const minHeight = Math.max(300, groupData.requiredHeight ?? 300);
  const showProjectHandles = groupData.groupKind === "project";

  return (
    <div
      className={cn(
        "h-full w-full rounded-[22px] border border-border/80 bg-card p-0 shadow-[0_16px_30px_-18px_color-mix(in_oklch,black_80%,transparent)]",
        "bg-[var(--subflow-bg)]",
        selected && mode === "move" ? "border-emerald-400/80 shadow-[0_0_0_1px_rgba(16,185,129,0.5)]" : "",
        selected && mode === "resize" ? "border-amber-400/80 shadow-[0_0_0_1px_rgba(251,191,36,0.55)]" : "",
      )}
    >
      {showProjectHandles ? <Handle id="project-in" type="target" position={Position.Top} className="!h-2 !w-2 !border-0 !bg-transparent" /> : null}
      {showProjectHandles ? <Handle id="project-out" type="source" position={Position.Bottom} className="!h-2 !w-2 !border-0 !bg-transparent" /> : null}
      <NodeResizer
        isVisible={selected && mode === "resize"}
        minWidth={minWidth}
        minHeight={minHeight}
        lineClassName="!border-primary/50"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-0 !bg-primary/80"
      />
      <div className="flex h-[54px] items-center gap-3 px-4">
        <span className="h-3 w-3 rounded bg-primary/95" />
        <p className="truncate text-lg font-semibold tracking-tight text-foreground">{titleLabel}</p>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              groupData.onResetGroup?.(groupData.groupId);
            }}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-border/70 bg-background/55 text-white transition-colors"
            aria-label={`Reset ${groupData.label} layout`}
            title="Reset group layout"
          >
            <RefreshCw className="h-4 w-4 stroke-[2.25] text-white" />
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              groupData.onToggleCollapse?.(groupData.groupId);
            }}
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-border/70 bg-background/55 text-white transition-colors"
            aria-label={groupData.collapsed ? `Expand ${groupData.label} subflow` : `Collapse ${groupData.label} subflow`}
            title={groupData.collapsed ? "Expand subflow" : "Collapse subflow"}
          >
            {groupData.collapsed ? <ChevronRight className="h-4 w-4 stroke-[2.25] text-white" /> : <ChevronDown className="h-4 w-4 stroke-[2.25] text-white" />}
          </button>
        </div>
      </div>
      <div className="mx-4 h-px bg-white/28" />
    </div>
  );
}
