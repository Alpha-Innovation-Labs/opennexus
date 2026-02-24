import type {
  ContextOption,
  LiveSessionSnapshot,
  NextActionRow,
  TaskStatusSnapshot,
  WorkspaceFile,
  WorkspaceLoadedFile,
} from "@/entities/workspace/types";

type WorkspaceApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    path?: string;
  };
};

export class WorkspaceApiRequestError extends Error {
  readonly code?: string;
  readonly path?: string;

  constructor(message: string, options?: { code?: string; path?: string }) {
    super(message);
    this.code = options?.code;
    this.path = options?.path;
  }
}

function parseError(payload: WorkspaceApiErrorPayload, fallback: string): WorkspaceApiRequestError {
  return new WorkspaceApiRequestError(payload.error?.message ?? fallback, {
    code: payload.error?.code,
    path: payload.error?.path,
  });
}

export async function listWorkspaceFiles(): Promise<WorkspaceFile[]> {
  const response = await fetch("/api/workspace/files", { cache: "no-store" });
  const payload = (await response.json()) as { files?: WorkspaceFile[] } & WorkspaceApiErrorPayload;
  if (!response.ok) {
    throw parseError(payload, "Unable to list workspace files.");
  }
  return payload.files ?? [];
}

export async function loadWorkspaceFile(filePath: string): Promise<WorkspaceLoadedFile> {
  const response = await fetch(`/api/workspace/file?path=${encodeURIComponent(filePath)}`, { cache: "no-store" });
  const payload = (await response.json()) as WorkspaceLoadedFile & WorkspaceApiErrorPayload;
  if (!response.ok) {
    throw parseError(payload, "Unable to load markdown file.");
  }
  return payload;
}

export async function saveWorkspaceFile(input: {
  path: string;
  content: string;
  expectedMtimeMs?: number;
}): Promise<WorkspaceLoadedFile> {
  const response = await fetch("/api/workspace/file", {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as WorkspaceLoadedFile & WorkspaceApiErrorPayload;
  if (!response.ok) {
    throw parseError(payload, "Unable to save markdown file.");
  }
  return payload;
}

export async function fetchContexts(): Promise<ContextOption[]> {
  const response = await fetch("/api/workspace/contexts", { cache: "no-store" });
  const payload = (await response.json()) as { contexts?: ContextOption[] } & WorkspaceApiErrorPayload;
  if (!response.ok) {
    throw parseError(payload, "Unable to load context options.");
  }
  return payload.contexts ?? [];
}

export async function fetchNextActions(
  contextFile: string,
): Promise<{ contextId: string; rows: NextActionRow[] }> {
  const response = await fetch(`/api/workspace/next-actions?contextFile=${encodeURIComponent(contextFile)}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as { contextId: string; rows: NextActionRow[] } & WorkspaceApiErrorPayload;
  if (!response.ok) {
    throw parseError(payload, "Unable to load next-action rows.");
  }
  return payload;
}

export async function startRowExecution(input: {
  contextId: string;
  contextFile: string;
  testId: string;
}): Promise<{ ok: boolean; message: string }> {
  const response = await fetch("/api/workspace/execute", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as { ok?: boolean; error?: string; message?: string };
  if (!response.ok) {
    return {
      ok: false,
      message: payload.error ?? "Execution failed with an unknown backend error.",
    };
  }

  return {
    ok: true,
    message: payload.message ?? "Execution started successfully.",
  };
}

export async function fetchTaskStatus(
  contextId: string,
  testId: string,
): Promise<TaskStatusSnapshot> {
  const response = await fetch(
    `/api/workspace/status?contextId=${encodeURIComponent(contextId)}&testId=${encodeURIComponent(testId)}`,
    {
      cache: "no-store",
    },
  );
  return (await response.json()) as TaskStatusSnapshot;
}

export async function fetchLiveStream(
  contextFile: string,
  testId: string,
): Promise<LiveSessionSnapshot> {
  const response = await fetch(
    `/api/workspace/live-stream?contextFile=${encodeURIComponent(contextFile)}&testId=${encodeURIComponent(testId)}`,
    {
      cache: "no-store",
    },
  );
  return (await response.json()) as LiveSessionSnapshot;
}
