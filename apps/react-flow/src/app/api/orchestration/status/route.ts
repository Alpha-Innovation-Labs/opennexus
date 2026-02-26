import { NextResponse } from "next/server";

import {
  createNadStatusAdapter,
  type NadStatusAdapterError,
} from "@/features/orchestration-status/server/nad-orchestration-status-adapter";

const adapter = createNadStatusAdapter();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const contextFile = url.searchParams.get("contextFile") ?? "";

  try {
    const result = await adapter.status(contextFile);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const normalized = error as NadStatusAdapterError;
    const statusCode = mapErrorToHttpStatus(normalized.category);
    return NextResponse.json({ error: normalized }, { status: statusCode });
  }
}

function mapErrorToHttpStatus(category: NadStatusAdapterError["category"]): number {
  switch (category) {
    case "invalid_context_target":
    case "contract_missing_fields":
      return 400;
    case "command_timeout":
      return 504;
    case "binary_missing":
    case "invalid_json":
    case "command_failed":
    case "no_active_run":
    default:
      return 502;
  }
}
