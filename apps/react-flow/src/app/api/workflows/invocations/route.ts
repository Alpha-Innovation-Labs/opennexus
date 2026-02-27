import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

type InvocationSummary = {
  invocationId: string;
  startedAt: string;
  target: string;
  status: string;
  workflowId: string;
};

export async function GET() {
  try {
    const { stdout } = await execFileAsync("restate", [
      "invocations",
      "list",
      "--all",
      "--service",
      "ConversationWorkflow",
      "--time-format",
      "iso8601",
      "--limit",
      "100",
    ]);

    const invocations = parseInvocationList(stdout);

    return NextResponse.json({
      invocations,
      output: stdout.trim(),
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read Restate invocations";
    return NextResponse.json(
      {
        output: "",
        fetchedAt: new Date().toISOString(),
        error: message,
      },
      { status: 500 },
    );
  }
}

function parseInvocationList(text: string): InvocationSummary[] {
  const lines = text.split("\n");
  const results: InvocationSummary[] = [];
  let current: InvocationSummary | null = null;

  for (const line of lines) {
    const headerMatch = line.match(/^\s*❯\s*\[(.+?)\]\s+(inv_[A-Za-z0-9]+)/);
    if (headerMatch) {
      if (current) {
        results.push(current);
      }
      current = {
        startedAt: headerMatch[1]?.trim() ?? "",
        invocationId: headerMatch[2]?.trim() ?? "",
        target: "",
        status: "",
        workflowId: "",
      };
      continue;
    }

    if (!current) {
      continue;
    }

    const targetMatch = line.match(/^\s*Target:\s+(.+)$/);
    if (targetMatch) {
      current.target = targetMatch[1]?.trim() ?? "";
      current.workflowId = extractWorkflowId(current.target);
      continue;
    }

    const statusMatch = line.match(/^\s*Status:\s+(.+)$/);
    if (statusMatch) {
      current.status = statusMatch[1]?.trim() ?? "";
    }
  }

  if (current) {
    results.push(current);
  }

  return results;
}

function extractWorkflowId(target: string): string {
  const match = target.match(/^ConversationWorkflow\/(.+?)\/run/);
  return match?.[1] ?? "";
}
