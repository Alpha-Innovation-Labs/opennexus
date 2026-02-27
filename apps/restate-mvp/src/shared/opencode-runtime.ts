import { createOpencode, createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk";

import { extractError } from "./values";

type OpencodeRuntime = {
  client: OpencodeClient;
  close: () => void;
};

let runtimePromise: Promise<OpencodeRuntime> | null = null;

export async function askOpencode(prompt: string, directory: string): Promise<string> {
  try {
    const runtime = await getRuntime();

    const created = await runtime.client.session.create({
      query: { directory },
      body: { title: "Restate Dynamic Pipeline Conversation" },
    });

    if (created.error || !created.data) {
      return `OpenCode call failed: session create error (${extractError(created.error)})`;
    }

    const replied = await runtime.client.session.prompt({
      path: { id: created.data.id },
      query: { directory },
      body: { parts: [{ type: "text", text: prompt }] },
    });

    if (replied.error || !replied.data) {
      return `OpenCode call failed: prompt error (${extractError(replied.error)})`;
    }

    const text = (replied.data.parts as Array<{ type: string; text?: string }>)
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text ?? "")
      .join("")
      .trim();

    return text || "OpenCode returned no readable text.";
  } catch (error) {
    return `OpenCode call failed: ${extractError(error)}`;
  }
}

async function getRuntime(): Promise<OpencodeRuntime> {
  if (!runtimePromise) {
    const port = Number(process.env.RBX_OPENCODE_PORT ?? process.env.OPENCODE_SDK_PORT ?? "4096");
    runtimePromise = (async () => {
      if (await isPortReachable(port)) {
        const client = createOpencodeClient({ baseUrl: `http://127.0.0.1:${port}` });
        return { client, close: () => {} };
      }

      try {
        const { client, server } = await createOpencode({
          hostname: "127.0.0.1",
          port,
          timeout: 20000,
        });
        return {
          client,
          close: () => server.close(),
        };
      } catch (error) {
        const message = extractError(error);
        if (message.includes("Failed to start server on port")) {
          const client = createOpencodeClient({ baseUrl: `http://127.0.0.1:${port}` });
          return { client, close: () => {} };
        }
        throw error;
      }
    })().catch((error) => {
      runtimePromise = null;
      throw error;
    });
  }

  return runtimePromise;
}

async function isPortReachable(port: number): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);
    const response = await fetch(`http://127.0.0.1:${port}/`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response.status > 0;
  } catch {
    return false;
  }
}
