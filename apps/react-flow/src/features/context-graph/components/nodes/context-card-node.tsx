import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react";
import { Trash2 } from "lucide-react";

import type { ContextFlowNodeData } from "@/features/context-graph/services/context-graph-layout-service";
import { cn } from "@/shared/lib/cn";

export function ContextCardNode({ data, selected }: NodeProps) {
  const nodeData = data as ContextFlowNodeData;
  const mode = nodeData.interactionMode ?? "select";
  const status = nodeData.orchestrationStatus;
  const statusClass =
    status?.isError
      ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
      : status?.status === "running"
        ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
        : status?.status === "success"
          ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
          : "border-border/60 bg-background/70 text-muted-foreground";

  return (
    <>
      <Handle type="target" id="in" position={Position.Top} className="!h-2.5 !w-2.5 !border-0 !bg-primary/70 !opacity-0" />
      <NodeResizer
        isVisible={selected && mode === "resize"}
        minWidth={260}
        minHeight={80}
        lineClassName="!border-primary/50"
        handleClassName="!h-2.5 !w-2.5 !rounded-sm !border-0 !bg-primary/80"
      />
      <div
        className={cn(
          "context-drag-handle h-full w-full rounded-[18px] border bg-card p-3 text-left shadow-[0_12px_26px_-16px_color-mix(in_oklch,black_75%,transparent)] transition-colors",
          mode === "move" ? "cursor-grab active:cursor-grabbing" : "cursor-default",
          mode === "move" ? "border-emerald-500/45 hover:border-emerald-400/65" : "",
          mode === "resize" ? "border-amber-500/45 hover:border-amber-400/65" : "",
          mode === "select" ? "border-border/80 hover:border-primary/55" : "",
          selected && mode === "move" ? "border-emerald-300 shadow-[0_0_0_2px_rgba(16,185,129,0.45)]" : "",
          selected && mode === "resize" ? "border-amber-300 shadow-[0_0_0_2px_rgba(251,191,36,0.45)]" : "",
          selected && mode === "select" ? "border-primary/75 shadow-[0_0_0_1px_rgba(56,189,248,0.35)]" : "",
        )}
      >
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded bg-primary/95" />
          <p className="truncate text-2xl font-semibold leading-none text-foreground">{nodeData.context.id}</p>
          <Trash2 className="ml-auto h-4 w-4 text-muted-foreground/75" />
        </div>
        <div className="mt-3 border-t border-border/60" />
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <span>{nodeData.context.feature}</span>
          <span className="inline-flex items-center gap-2">
            <span>{nodeData.context.project}</span>
            <span className="h-3 w-3 rounded-full bg-primary/95" />
          </span>
        </div>
        <div className="mt-3 border-t border-border/60" />
        <div className="mt-3">
          <p className="text-sm font-semibold text-muted-foreground">Title</p>
          <div className="mt-2 rounded-xl border border-border/65 bg-background/55 px-3 py-2">
            <p className="line-clamp-2 text-base font-semibold leading-tight text-foreground/90">{nodeData.title}</p>
          </div>
        </div>
        <div className="mt-3">
          <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]", statusClass)}>
            {status ? status.status : "unknown"}
          </span>
        </div>
      </div>
      <Handle type="source" id="out" position={Position.Bottom} className="!h-2.5 !w-2.5 !border-0 !bg-primary/70 !opacity-0" />
    </>
  );
}
