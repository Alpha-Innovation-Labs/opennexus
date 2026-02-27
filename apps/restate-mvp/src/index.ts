import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { createOpencode, createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk";
import * as restate from "@restatedev/restate-sdk";

type OpencodeRuntime = {
  client: OpencodeClient;
  close: () => void;
  directory: string;
};

let runtimePromise: Promise<OpencodeRuntime> | null = null;

type RunInput = {
  promptFile?: string;
};

type RunOutput = {
  step_1_prompt: string;
  step_2_opencode_answer: string;
  step_3_explanation: string;
};

const workflow = restate.workflow({
  name: "ConversationWorkflow",
  handlers: {
    run: async (ctx: restate.WorkflowContext, input: RunInput): Promise<RunOutput> => {
      const prompt = await ctx.run("load_prompt", async () => {
        const requestedPath = input?.promptFile ?? "prompts/weather.txt";
        const promptFile = isAbsolute(requestedPath)
          ? requestedPath
          : resolve(process.cwd(), requestedPath);
        const fileContent = await readFile(promptFile, "utf-8");
        const trimmed = fileContent.trim();
        return `${trimmed}\n\nQuestion: What's the weather right now in Paris?`; 
      });

      const opencodeAnswer = await ctx.run("ask_opencode", async () => {
        try {
          const runtime = await getRuntime();

          const created = await runtime.client.session.create({
            query: { directory: runtime.directory },
            body: { title: "Restate MVP Conversation" },
          });

          if (created.error || !created.data) {
            return `OpenCode call failed: session create error (${extractError(created.error)})`;
          }

          const replied = await runtime.client.session.prompt({
            path: { id: created.data.id },
            query: { directory: runtime.directory },
            body: {
              parts: [{ type: "text", text: prompt }],
            },
          });

          if (replied.error || !replied.data) {
            return `OpenCode call failed: prompt error (${extractError(replied.error)})`;
          }

          return extractAnswerFromParts(replied.data.parts as Array<{ type: string; text?: string }>);
        } catch (error) {
          return `OpenCode call failed: ${extractError(error)}`;
        }
      });

      const explanation = await ctx.run("explain_result", async () => {
        return summarizeStepTwo(opencodeAnswer);
      });

      return {
        step_1_prompt: prompt,
        step_2_opencode_answer: opencodeAnswer,
        step_3_explanation: explanation,
      };
    },
  },
});

function extractAnswerFromParts(parts: Array<{ type: string; text?: string }>): string {
  const text = parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text ?? "")
    .join("")
    .trim();

  if (text.length === 0) {
    return "OpenCode returned no readable text.";
  }

  return text;
}

function extractError(value: unknown): string {
  if (value instanceof Error) {
    return value.message.replace(/\s+/g, " ").trim();
  }

  if (typeof value === "string") {
    return value.replace(/\s+/g, " ").trim();
  }

  if (typeof value === "object" && value !== null) {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function resolveRepoRoot(): string {
  return resolve(process.cwd(), "..", "..");
}

async function getRuntime(): Promise<OpencodeRuntime> {
  if (!runtimePromise) {
    const port = Number(process.env.RBX_OPENCODE_PORT ?? process.env.OPENCODE_SDK_PORT ?? "4196");
    runtimePromise = createOpencode({
      hostname: "127.0.0.1",
      port,
      timeout: 20000,
    })
      .then(({ client, server }) => ({
        client,
        close: () => server.close(),
        directory: resolveRepoRoot(),
      }))
      .catch(async (error) => {
        const message = extractError(error);
        if (message.includes("Failed to start server on port")) {
          const client = createOpencodeClient({
            baseUrl: `http://127.0.0.1:${port}`,
          });
          return {
            client,
            close: () => {},
            directory: resolveRepoRoot(),
          };
        }

        runtimePromise = null;
        throw error;
      });
  }

  return runtimePromise;
}

function summarizeStepTwo(stepTwo: string): string {
  const normalized = stepTwo.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "No answer to summarize.";
  }

  const sentence = normalized.match(/^(.+?[.!?])(\s|$)/);
  if (sentence?.[1]) {
    return sentence[1].trim();
  }

  if (normalized.length <= 200) {
    return normalized;
  }

  return `${normalized.slice(0, 197).trimEnd()}...`;
}

restate.serve({
  services: [workflow],
});
