import type { NodeProps } from "@xyflow/react";

interface ForkGroupNodeData {
  label: string;
  forkCount: number;
}

export function ForkGroupNode({ data }: NodeProps) {
  const nodeData = data as unknown as ForkGroupNodeData;

  return (
    <div className="h-full w-full rounded-[22px] border border-border/80 bg-card/90 bg-[var(--subflow-bg)] p-0 shadow-[0_16px_30px_-18px_color-mix(in_oklch,black_80%,transparent)]">
      <div className="flex h-[54px] items-center gap-3 px-4">
        <span className="h-3 w-3 rounded bg-primary/95" />
        <p className="truncate text-lg font-semibold tracking-tight text-foreground" title={nodeData.label}>
          {nodeData.label}
        </p>
        <span className="ml-auto rounded border border-border/70 bg-background/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          {nodeData.forkCount} forks
        </span>
      </div>
      <div className="mx-4 h-px bg-white/28" />
    </div>
  );
}
