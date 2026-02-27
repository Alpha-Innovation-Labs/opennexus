import fsSync from "node:fs";
import path from "node:path";
import { createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk/client";

interface OpencodeRuntime {
  client: OpencodeClient;
}

interface ConversationCreateResult {
  id: string;
  title: string;
}

interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
}

interface ForkConversationSummary {
  id: string;
  title: string;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: ConversationToolCall[];
  createdAt: number;
}

interface ConversationReplyResult {
  text: string;
}

interface StreamedConversationEvent {
  type: "delta" | "tool" | "done" | "error";
  text?: string;
  message?: string;
  toolCall?: ConversationToolCall;
}

interface ConversationToolCall {
  id: string;
  callId: string;
  tool: string;
  status: "pending" | "running" | "completed" | "error" | "unknown";
  title?: string;
  input?: string;
  output?: string;
  error?: string;
}

let runtimePromise: Promise<OpencodeRuntime> | null = null;

function resolveRepoRoot(): string {
  if (process.env.NEXUS_REPO_ROOT) {
    return path.resolve(process.env.NEXUS_REPO_ROOT);
  }

  let current = path.resolve(process.cwd());
  while (true) {
    if (fsSync.existsSync(path.join(current, ".nexus", "context"))) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      break;
    }

    current = parent;
  }

  return path.resolve(process.cwd(), "../..");
}

function resolveOpencodeBaseUrl(): string {
  const configured = process.env.OPENCODE_BASE_URL?.trim();
  if (configured && configured.length > 0) {
    return configured;
  }

  return "http://127.0.0.1:4096";
}

async function getRuntime(): Promise<OpencodeRuntime> {
  if (!runtimePromise) {
    runtimePromise = Promise.resolve({
      client: createOpencodeClient({
        baseUrl: resolveOpencodeBaseUrl(),
      }),
    }).catch((error) => {
      runtimePromise = null;
      throw error;
    });
  }

  return runtimePromise;
}

function normalizeAssistantText(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

function normalizeMessageText(parts: Array<{ type: string; text?: string }>): string {
  return parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

function safeStringify(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeToolCalls(parts: Array<Record<string, unknown>>): ConversationToolCall[] {
  return parts
    .filter((part) => part.type === "tool")
    .map((part) => {
      const state = (part.state ?? {}) as Record<string, unknown>;
      const status = typeof state.status === "string" ? state.status : "unknown";

      return {
        id: typeof part.id === "string" ? part.id : `${part.callID ?? "tool"}`,
        callId: typeof part.callID === "string" ? part.callID : typeof part.id === "string" ? part.id : "unknown",
        tool: typeof part.tool === "string" ? part.tool : "unknown",
        status:
          status === "pending" || status === "running" || status === "completed" || status === "error" ? status : "unknown",
        title: typeof state.title === "string" ? state.title : undefined,
        input: safeStringify(state.input),
        output: typeof state.output === "string" ? state.output : safeStringify(state.output),
        error: typeof state.error === "string" ? state.error : undefined,
      };
    });
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const runtime = await getRuntime();
  const repoRoot = resolveRepoRoot();

  const result = await runtime.client.session.list({
    query: { directory: repoRoot },
  });

  if (result.error || !result.data) {
    throw new Error("Failed to list OpenCode conversations");
  }

  return result.data
    .map((session) => ({
      id: session.id,
      title: session.title,
      updatedAt: session.time.updated,
    }))
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function listForkConversations(): Promise<ForkConversationSummary[]> {
  const runtime = await getRuntime();
  const repoRoot = resolveRepoRoot();

  const result = await runtime.client.session.list({
    query: { directory: repoRoot },
  });

  if (result.error || !result.data) {
    throw new Error("Failed to list OpenCode conversations");
  }

  const raw = result.data.map((session) => ({
    id: session.id,
    title: session.title,
    parentId: session.parentID ?? null,
    createdAt: session.time.created,
    updatedAt: session.time.updated,
  }));

  const parentIds = new Set(raw.map((entry) => entry.parentId).filter((entry): entry is string => Boolean(entry)));

  return raw
    .filter((entry) => entry.parentId !== null || parentIds.has(entry.id))
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export async function listConversationMessages(conversationId: string, limit = 80): Promise<ConversationMessage[]> {
  const runtime = await getRuntime();
  const repoRoot = resolveRepoRoot();

  const result = await runtime.client.session.messages({
    path: { id: conversationId },
    query: { directory: repoRoot, limit },
  });

  if (result.error || !result.data) {
    throw new Error("Failed to list OpenCode conversation messages");
  }

  return result.data
    .map((message) => ({
      id: message.info.id,
      role: message.info.role,
      content: normalizeMessageText(message.parts),
      toolCalls: normalizeToolCalls(message.parts as Array<Record<string, unknown>>),
      createdAt: message.info.time.created,
    }))
    .filter((message) => message.content.length > 0 || message.toolCalls.length > 0);
}

export async function createConversation(title?: string): Promise<ConversationCreateResult> {
  const runtime = await getRuntime();
  const repoRoot = resolveRepoRoot();

  const result = await runtime.client.session.create({
    query: { directory: repoRoot },
    ...(title ? { body: { title } } : {}),
  });

  if (result.error || !result.data) {
    throw new Error("Failed to create OpenCode conversation session");
  }

  return {
    id: result.data.id,
    title: result.data.title,
  };
}

export async function forkConversation(sourceConversationId: string, upToMessageId?: string): Promise<ConversationCreateResult> {
  const runtime = await getRuntime();
  const repoRoot = resolveRepoRoot();

  const forkResult = await runtime.client.session.fork({
    path: { id: sourceConversationId },
    query: { directory: repoRoot },
    ...(upToMessageId ? { body: { messageID: upToMessageId } } : {}),
  });

  if (forkResult.error || !forkResult.data) {
    throw new Error("Failed to fork OpenCode conversation session");
  }

  return {
    id: forkResult.data.id,
    title: forkResult.data.title,
  };
}

export async function sendConversationMessage(conversationId: string, message: string): Promise<ConversationReplyResult> {
  const runtime = await getRuntime();
  const repoRoot = resolveRepoRoot();

  const result = await runtime.client.session.prompt({
    path: { id: conversationId },
    query: { directory: repoRoot },
    body: {
      parts: [{ type: "text", text: message }],
    },
  });

  if (result.error || !result.data) {
    throw new Error("Failed to send OpenCode message");
  }

  return {
    text: normalizeAssistantText(result.data.parts),
  };
}

export async function streamConversationMessage(
  conversationId: string,
  message: string,
  requestSignal?: AbortSignal,
): Promise<AsyncGenerator<StreamedConversationEvent>> {
  const runtime = await getRuntime();
  const repoRoot = resolveRepoRoot();

  const beforeResult = await runtime.client.session.messages({
    path: { id: conversationId },
    query: { directory: repoRoot, limit: 80 },
  });

  if (beforeResult.error || !beforeResult.data) {
    throw new Error("Failed to read conversation state before streaming reply");
  }

  const knownAssistantIds = new Set(
    beforeResult.data.filter((entry) => entry.info.role === "assistant").map((entry) => entry.info.id),
  );

  const startedAt = Date.now();

  const promptResult = await runtime.client.session.promptAsync({
    path: { id: conversationId },
    query: { directory: repoRoot },
    body: {
      parts: [{ type: "text", text: message }],
    },
  });

  if (promptResult.error) {
    throw new Error("Failed to send OpenCode prompt asynchronously");
  }

  async function* eventGenerator(): AsyncGenerator<StreamedConversationEvent> {
    const deadlineAt = startedAt + 90_000;
    let assistantMessageId: string | null = null;
    let previousText = "";
    const knownToolFingerprints = new Map<string, string>();

    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      });

    try {
      while (Date.now() < deadlineAt) {
        if (requestSignal?.aborted) {
          yield { type: "error", message: "Request aborted" };
          return;
        }

        const messagesResult = await runtime.client.session.messages({
          path: { id: conversationId },
          query: { directory: repoRoot, limit: 80 },
        });

        if (messagesResult.error || !messagesResult.data) {
          throw new Error("Failed to fetch streaming messages");
        }

        if (!assistantMessageId) {
          const candidate = [...messagesResult.data]
            .reverse()
            .find((entry) => {
              if (entry.info.role !== "assistant") {
                return false;
              }

              return !knownAssistantIds.has(entry.info.id);
            });

          if (candidate) {
            assistantMessageId = candidate.info.id;
          }
        }

        if (assistantMessageId) {
          const assistantEntry = messagesResult.data.find((entry) => entry.info.id === assistantMessageId);

          if (assistantEntry) {
            const nextText = normalizeMessageText(assistantEntry.parts);
            if (nextText.length > previousText.length) {
              yield { type: "delta", text: nextText.slice(previousText.length) };
              previousText = nextText;
            }

            const toolCalls = normalizeToolCalls(assistantEntry.parts as Array<Record<string, unknown>>);
            for (const toolCall of toolCalls) {
              const fingerprint = JSON.stringify({
                status: toolCall.status,
                title: toolCall.title,
                output: toolCall.output,
                error: toolCall.error,
              });
              const previousFingerprint = knownToolFingerprints.get(toolCall.callId);
              if (previousFingerprint !== fingerprint) {
                knownToolFingerprints.set(toolCall.callId, fingerprint);
                yield { type: "tool", toolCall };
              }
            }

            const completedAt = "completed" in assistantEntry.info.time ? assistantEntry.info.time.completed : undefined;
            if (typeof completedAt === "number") {
              yield { type: "done" };
              return;
            }
          }
        }

        await sleep(250);
      }

      if (previousText.length > 0) {
        yield { type: "done" };
      } else {
        yield { type: "error", message: "Timed out waiting for streamed response" };
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : "unknown_error";
      yield { type: "error", message: detail };
    }
  }

  return eventGenerator();
}
