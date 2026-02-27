"use client";

import { useEffect, useState } from "react";

import type { WorkflowInvocationSummary } from "@/features/workspace-shell/model/workflow-invocation";
import { Badge } from "@/shared/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Skeleton } from "@/shared/ui/skeleton";

type WorkflowDetailsResponse = {
  describeOutput: string;
  workflowOutput: Record<string, unknown> | null;
  workflowOutputError: string | null;
};

interface WorkflowsViewProps {
  selectedInvocation: WorkflowInvocationSummary | null;
}

export function WorkflowsView({ selectedInvocation }: WorkflowsViewProps) {
  const [workflowOutput, setWorkflowOutput] = useState<Record<string, unknown> | null>(null);
  const [describeOutput, setDescribeOutput] = useState<string>("");
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  useEffect(() => {
    if (!selectedInvocation) {
      setWorkflowOutput(null);
      setDescribeOutput("");
      setDetailsError(null);
      return;
    }

    let isCancelled = false;

    const loadDetails = async () => {
      setIsLoadingDetails(true);
      setDetailsError(null);
      try {
        const response = await fetch(
          `/api/workflows/invocations/${selectedInvocation.invocationId}?workflowId=${encodeURIComponent(selectedInvocation.workflowId)}`,
          { cache: "no-store" },
        );
        const payload = (await response.json()) as WorkflowDetailsResponse;
        if (!response.ok) {
          throw new Error(payload.workflowOutputError ?? "Failed to fetch invocation details");
        }

        if (isCancelled) {
          return;
        }

        setDescribeOutput(payload.describeOutput);
        setWorkflowOutput(payload.workflowOutput);
        setDetailsError(payload.workflowOutputError);
      } catch (nextError) {
        if (isCancelled) {
          return;
        }
        const message = nextError instanceof Error ? nextError.message : "Failed to fetch invocation details";
        setDetailsError(message);
        setWorkflowOutput(null);
        setDescribeOutput("");
      } finally {
        if (!isCancelled) {
          setIsLoadingDetails(false);
        }
      }
    };

    void loadDetails();

    return () => {
      isCancelled = true;
    };
  }, [selectedInvocation]);

  const stepEntries =
    workflowOutput && typeof workflowOutput.steps === "object" && workflowOutput.steps !== null
      ? Object.entries(workflowOutput.steps as Record<string, unknown>)
      : [];

  if (!selectedInvocation) {
    return (
      <section className="flex h-full min-h-0 p-4">
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Workflow Details</CardTitle>
            <CardDescription>Select an invocation from the left sidebar.</CardDescription>
          </CardHeader>
        </Card>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 p-4">
      <div className="min-h-0 w-full space-y-3 overflow-auto">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{selectedInvocation.workflowId || selectedInvocation.invocationId}</CardTitle>
            <CardDescription>{selectedInvocation.target}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant={statusVariant(selectedInvocation.status)}>{selectedInvocation.status}</Badge>
            <span className="text-muted-foreground">{selectedInvocation.startedAt}</span>
            <span className="font-mono text-muted-foreground">{selectedInvocation.invocationId}</span>
          </CardContent>
        </Card>

        {isLoadingDetails ? (
          <Card>
            <CardContent className="space-y-3 py-4">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ) : null}

        {detailsError ? (
          <Card>
            <CardContent className="py-4 text-xs text-amber-300">{detailsError}</CardContent>
          </Card>
        ) : null}

        {workflowOutput ? (
          <Card>
            <CardHeader>
              <CardTitle>Result</CardTitle>
              <CardDescription>Top-level workflow output</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <KeyValue label="Pipeline" value={workflowOutput.pipeline_name} />
              <KeyValue label="Prompt" value={workflowOutput.step_1_prompt} multiline />
              <KeyValue label="Answer" value={workflowOutput.step_2_opencode_answer} multiline />
              <KeyValue label="Summary" value={workflowOutput.step_3_explanation} multiline />
              <KeyValue label="Final Result" value={workflowOutput.result_text} multiline />
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Steps</CardTitle>
            <CardDescription>Each workflow step and its output</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoadingDetails ? (
              <>
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </>
            ) : stepEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground">No step outputs available yet.</p>
            ) : (
              stepEntries.map(([stepId, result]) => (
                <div key={stepId} className="rounded-md border border-border/70 bg-background/40 p-3">
                  <p className="mb-2 text-sm font-semibold text-foreground">{stepId}</p>
                  {renderStepResult(result)}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invocation Trace</CardTitle>
            <CardDescription>Raw Restate describe output</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-muted-foreground">
              {describeOutput || "No invocation trace available."}
            </pre>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status.includes("success") || status.includes("completed")) {
    return "secondary";
  }
  if (status.includes("failed") || status.includes("backing-off") || status.includes("error")) {
    return "destructive";
  }
  return "outline";
}

function KeyValue({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: unknown;
  multiline?: boolean;
}) {
  const text = stringifyValue(value);
  if (!text) {
    return null;
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
      <p className={multiline ? "whitespace-pre-wrap text-sm text-foreground" : "text-sm text-foreground"}>{text}</p>
    </div>
  );
}

function renderStepResult(result: unknown) {
  if (typeof result !== "object" || result === null) {
    return <p className="text-xs text-muted-foreground">{stringifyValue(result)}</p>;
  }

  const entries = Object.entries(result as Record<string, unknown>);
  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground">No step values.</p>;
  }

  return (
    <div className="space-y-2">
      {entries.map(([key, value]) => (
        <div key={key}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{key}</p>
          <p className="whitespace-pre-wrap break-words text-xs text-foreground">{stringifyValue(value)}</p>
        </div>
      ))}
    </div>
  );
}

function stringifyValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null || value === undefined) {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
