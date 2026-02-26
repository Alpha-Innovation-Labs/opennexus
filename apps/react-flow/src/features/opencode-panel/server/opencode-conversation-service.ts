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

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ConversationReplyResult {
  text: string;
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

export async function listConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
  const runtime = await getRuntime();
  const repoRoot = resolveRepoRoot();

  const result = await runtime.client.session.messages({
    path: { id: conversationId },
    query: { directory: repoRoot, limit: 80 },
  });

  if (result.error || !result.data) {
    throw new Error("Failed to list OpenCode conversation messages");
  }

  return result.data
    .map((message) => ({
      id: message.info.id,
      role: message.info.role,
      content: normalizeMessageText(message.parts),
    }))
    .filter((message) => message.content.length > 0);
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
