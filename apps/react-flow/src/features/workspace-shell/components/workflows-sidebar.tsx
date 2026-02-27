"use client";

import { useCallback, useEffect, useState } from "react";

import type { WorkflowInvocationSummary } from "@/features/workspace-shell/model/workflow-invocation";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";

type WorkflowResponse = {
  invocations?: WorkflowInvocationSummary[];
  error?: string;
};

interface WorkflowsSidebarProps {
  selectedInvocationId: string | null;
  onSelectInvocation: (invocation: WorkflowInvocationSummary) => void;
}

export function WorkflowsSidebar({ selectedInvocationId, onSelectInvocation }: WorkflowsSidebarProps) {
  const [invocations, setInvocations] = useState<WorkflowInvocationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const load = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const response = await fetch("/api/workflows/invocations", { cache: "no-store" });
      const payload = (await response.json()) as WorkflowResponse;
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to fetch workflow invocations");
      }

      const nextInvocations = Array.isArray(payload.invocations) ? payload.invocations : [];
      setInvocations(nextInvocations);

      if (nextInvocations.length > 0) {
        const existing = nextInvocations.find((item) => item.invocationId === selectedInvocationId);
        onSelectInvocation(existing ?? nextInvocations[0]);
      }
    } catch (nextError) {
      const message = nextError instanceof Error ? nextError.message : "Failed to fetch workflow invocations";
      setError(message);
      setInvocations([]);
    } finally {
      setIsRefreshing(false);
    }
  }, [onSelectInvocation, selectedInvocationId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-0 flex-1 px-2 py-3">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Invocations</p>
        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={() => void load()}>
          {isRefreshing ? "..." : "Refresh"}
        </Button>
      </div>

      {error ? <p className="mb-2 px-1 text-[11px] text-amber-300">{error}</p> : null}

      <div className="space-y-2 overflow-auto pb-2">
        {isRefreshing && invocations.length === 0 ? (
          <>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </>
        ) : invocations.length === 0 ? (
          <p className="px-1 text-xs text-muted-foreground">No workflow invocations found.</p>
        ) : (
          invocations.map((invocation) => (
            <button
              key={invocation.invocationId}
              type="button"
              className={`w-full rounded-md border p-2 text-left transition-colors ${
                selectedInvocationId === invocation.invocationId
                  ? "border-primary/60 bg-primary/10"
                  : "border-border/70 bg-background/60 hover:bg-background"
              }`}
              onClick={() => onSelectInvocation(invocation)}
            >
              <p className="truncate text-xs font-semibold text-foreground">{invocation.workflowId || invocation.invocationId}</p>
              <p className="truncate text-[11px] text-muted-foreground">{invocation.status}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
