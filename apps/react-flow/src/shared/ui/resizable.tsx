"use client";

import { GripVertical } from "lucide-react";
import * as React from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

import { cn } from "@/shared/lib/cn";

function ResizablePanelGroup({ className, ...props }: React.ComponentProps<typeof Group>) {
  return <Group className={cn("flex h-full w-full", className)} {...props} />;
}

function ResizablePanel({ ...props }: React.ComponentProps<typeof Panel>) {
  return <Panel {...props} />;
}

function ResizableHandle({ withHandle, className, ...props }: React.ComponentProps<typeof Separator> & { withHandle?: boolean }) {
  return (
    <Separator
      className={cn(
        "relative flex w-2 items-center justify-center bg-border/70 transition-colors hover:bg-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
        className,
      )}
      {...props}
    >
      {withHandle ? (
        <div className="z-10 flex h-10 w-4 items-center justify-center rounded-full border border-border/70 bg-card text-muted-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
      ) : null}
    </Separator>
  );
}

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
