import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

interface Params {
  params: Promise<{ invocationId: string }>;
}

export async function GET(request: Request, { params }: Params) {
  const { invocationId } = await params;
  const url = new URL(request.url);
  const workflowId = url.searchParams.get("workflowId") ?? "";

  try {
    const { stdout } = await execFileAsync("restate", [
      "invocations",
      "describe",
      invocationId,
      "--time-format",
      "iso8601",
    ]);

    const details: {
      describeOutput: string;
      workflowOutput: Record<string, unknown> | null;
      workflowOutputError: string | null;
      fetchedAt: string;
    } = {
      describeOutput: stdout.trim(),
      workflowOutput: null,
      workflowOutputError: null,
      fetchedAt: new Date().toISOString(),
    };

    if (workflowId) {
      const outputResponse = await fetch(`http://localhost:8080/restate/workflow/ConversationWorkflow/${workflowId}/output`);
      const bodyText = await outputResponse.text();

      if (outputResponse.ok) {
        try {
          details.workflowOutput = JSON.parse(bodyText) as Record<string, unknown>;
        } catch {
          details.workflowOutputError = "Workflow output was not valid JSON";
        }
      } else {
        details.workflowOutputError = bodyText || `Workflow output not ready (${outputResponse.status})`;
      }
    }

    return NextResponse.json(details);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read invocation details";
    return NextResponse.json(
      {
        describeOutput: "",
        workflowOutput: null,
        workflowOutputError: message,
        fetchedAt: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
