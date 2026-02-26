"use client";

import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { ContextNodeEntity } from "@/features/context-graph/model/context-graph-types";
import type {
  NadPipelineStatus,
  NadStatusAdapterError,
  NadStatusResult,
} from "@/features/orchestration-status/model/nad-orchestration-status-types";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/dialog";

interface ContextDetailsModalProps {
  context: ContextNodeEntity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ContextDetailsModal({ context, open, onOpenChange }: ContextDetailsModalProps) {
  const [statusPayload, setStatusPayload] = useState<NadPipelineStatus | null>(null);
  const [statusError, setStatusError] = useState<NadStatusAdapterError | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!context) {
      setStatusPayload(null);
      setStatusError(null);
      return;
    }

    setLoadingStatus(true);
    setStatusError(null);

    try {
      const response = await fetch(`/api/orchestration/status?contextFile=${encodeURIComponent(context.path)}`, {
        method: "GET",
      });
      const body = (await response.json()) as NadStatusResult | { error: NadStatusAdapterError };

      if (!response.ok || "error" in body) {
        const errorPayload = "error" in body ? body.error : null;
        setStatusPayload(null);
        setStatusError(
          errorPayload ?? {
            category: "command_failed",
            message: "Failed to read orchestration status.",
            remediation: "Retry the request and verify CLI availability.",
            source: {
              binary: "opennexus",
              commandName: "orchestration.status",
              args: [],
              durationMs: 0,
              exitStatus: null,
              timedOut: false,
            },
          },
        );
        return;
      }

      setStatusPayload(body.payload);
    } catch {
      setStatusPayload(null);
      setStatusError({
        category: "command_failed",
        message: "Network failure while querying orchestration status.",
        remediation: "Retry and ensure the Next.js server route is reachable.",
        source: {
          binary: "opennexus",
          commandName: "orchestration.status",
          args: [],
          durationMs: 0,
          exitStatus: null,
          timedOut: false,
        },
      });
    } finally {
      setLoadingStatus(false);
    }
  }, [context]);

  useEffect(() => {
    if (!open || !context) {
      return;
    }
    void fetchStatus();
  }, [context, fetchStatus, open]);

  const statusVariant: "default" | "secondary" | "outline" =
    statusPayload?.status === "running"
      ? "default"
      : statusPayload?.status === "success"
        ? "secondary"
        : "outline";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {context ? (
          <>
            <DialogHeader>
              <DialogTitle>{context.title}</DialogTitle>
              <DialogDescription>Context detail view with metadata and full markdown source body.</DialogDescription>
            </DialogHeader>

            <div className="flex flex-wrap gap-2">
              <Badge>ID: {context.id}</Badge>
              <Badge variant="secondary">Project: {context.project}</Badge>
              <Badge variant="secondary">Feature: {context.feature}</Badge>
              <Badge variant="outline">Path: {context.path}</Badge>
              {statusPayload ? <Badge variant={statusVariant}>Pipeline status: {statusPayload.status}</Badge> : null}
            </div>

            <div className="rounded-xl border border-border/70 bg-background/60 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Orchestration</p>
                <Button size="sm" variant="ghost" onClick={() => void fetchStatus()} disabled={loadingStatus}>
                  {loadingStatus ? "Refreshing..." : "Refresh status"}
                </Button>
              </div>

              {statusPayload ? (
                <div className="mt-2 space-y-1 text-sm">
                  <p className="text-foreground">{statusPayload.message}</p>
                  <p className="text-muted-foreground">
                    Run: {statusPayload.runId ?? "none"} | Active: {statusPayload.activeRunIds.length}
                  </p>
                  {statusPayload.pipelineName ? (
                    <p className="text-muted-foreground">Pipeline: {statusPayload.pipelineName}</p>
                  ) : null}
                </div>
              ) : null}

              {statusError ? (
                <div className="mt-2 space-y-1 text-sm text-amber-300">
                  <p>{statusError.message}</p>
                  <p className="text-muted-foreground">{statusError.remediation}</p>
                </div>
              ) : null}
            </div>

            <article className="max-h-[62vh] overflow-auto rounded-xl border border-border/70 bg-background/65 p-4 text-sm leading-6 text-foreground">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{context.content}</ReactMarkdown>
            </article>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
