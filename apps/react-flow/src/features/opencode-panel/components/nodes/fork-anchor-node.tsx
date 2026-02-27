import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";

interface ForkAnchorLine {
  number: number;
  role: "user" | "assistant";
  text: string;
  focus: boolean;
}

interface ForkAnchorNodeData {
  lines: ForkAnchorLine[];
}

export function ForkAnchorNode({ data }: NodeProps) {
  const nodeData = data as unknown as ForkAnchorNodeData;

  return (
    <>
      <Handle type="target" id="anchor-in" position={Position.Left} className="!h-2.5 !w-2.5 !border-0 !bg-primary/70 !opacity-0" />
      <div className="h-full w-full rounded-xl border border-border/70 bg-background/70 p-2 text-xs">
        <div
          className="mb-2 h-4 rounded border border-border/50"
          style={{ backgroundImage: "repeating-linear-gradient(-45deg, rgba(148,163,184,0.12) 0 8px, transparent 8px 16px)" }}
        />
        <div className="space-y-1">
          {nodeData.lines.map((line) => (
            <div
              key={`${line.number}-${line.text.slice(0, 16)}`}
              className={`grid grid-cols-[30px_1fr] gap-2 rounded px-1 py-1 ${
                line.focus ? "border border-primary/40 bg-primary/10 text-foreground" : "text-muted-foreground"
              }`}
            >
              <span className="text-right tabular-nums opacity-80">{line.number}</span>
              <span className="truncate">
                <span className="mr-1 uppercase opacity-70">{line.role}</span>
                {line.text}
              </span>
            </div>
          ))}
        </div>
        <div
          className="mt-2 h-4 rounded border border-border/50"
          style={{ backgroundImage: "repeating-linear-gradient(-45deg, rgba(148,163,184,0.12) 0 8px, transparent 8px 16px)" }}
        />
      </div>
      <Handle type="source" id="anchor-out" position={Position.Right} className="!h-2.5 !w-2.5 !border-0 !bg-primary/70 !opacity-0" />
    </>
  );
}
