import { Handle, Position, type NodeProps } from "@xyflow/react";

interface RootTranscriptLine {
  number: number;
  role: "user";
  text: string;
  highlighted: boolean;
  handleId?: string;
}

interface ForkRootTranscriptNodeData {
  title: string;
  lines: RootTranscriptLine[];
}

export function ForkRootTranscriptNode({ data }: NodeProps) {
  const nodeData = data as unknown as ForkRootTranscriptNodeData;

  return (
    <div className="h-full w-full rounded-xl border border-border/70 bg-background/70 p-2 text-xs">
      <div className="mb-2 flex items-center gap-2 border-b border-border/60 pb-2">
        <span className="h-2.5 w-2.5 rounded bg-primary/95" />
        <p className="truncate text-xs font-semibold uppercase tracking-[0.08em] text-foreground">{nodeData.title}</p>
      </div>

      <div className="relative">
        {nodeData.lines.map((line) => (
          <div
            key={`${line.number}-${line.text.slice(0, 16)}`}
            className={`relative grid grid-cols-[30px_1fr] gap-2 rounded px-1 py-1 ${
              line.highlighted ? "border border-primary/40 bg-primary/10 text-foreground" : "text-muted-foreground"
            } h-7 items-center`}
          >
            <span className="text-right tabular-nums opacity-80">{line.number}</span>
            <span className="truncate">
              <span className="mr-1 uppercase opacity-70">{line.role}</span>
              {line.text}
            </span>
            {line.highlighted ? <span className="absolute -right-2 top-1/2 h-3 w-3 translate-x-1/2 -translate-y-1/2 rounded-full bg-primary" /> : null}
            {line.highlighted && line.handleId ? (
              <Handle
                id={line.handleId}
                type="source"
                position={Position.Right}
                className="!h-0 !w-0 !border-0 !bg-transparent"
                style={{ right: -8, top: "50%", transform: "translateY(-50%)" }}
              />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
