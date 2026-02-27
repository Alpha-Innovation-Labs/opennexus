import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, isAbsolute, resolve } from "node:path";
import { promisify } from "node:util";
import { createOpencode, createOpencodeClient, type OpencodeClient } from "@opencode-ai/sdk";
import * as restate from "@restatedev/restate-sdk";
import YAML from "yaml";

const execFileAsync = promisify(execFile);

type OpencodeRuntime = {
  client: OpencodeClient;
  close: () => void;
};

let runtimePromise: Promise<OpencodeRuntime> | null = null;

type RunInput = {
  pipelineFile?: string;
  configFile?: string;
  context?: Record<string, unknown>;
};

type PipelineDefinition = {
  name: string;
  steps: PipelineStep[];
};

type PipelineStep = {
  id: string;
  type: string;
  params?: Record<string, unknown>;
};

type StepOutput = Record<string, unknown>;

type PipelineState = {
  input: RunInput;
  config: Record<string, unknown>;
  steps: Record<string, StepOutput>;
};

const workflow = restate.workflow({
  name: "ConversationWorkflow",
  handlers: {
    run: async (ctx: restate.WorkflowContext, input: RunInput): Promise<Record<string, unknown>> => {
      const pipeline = await ctx.run("__load_pipeline__", async () => {
        const pipelineFile = input.pipelineFile ?? "pipelines/configurable-five-step.yaml";
        return loadPipeline(pipelineFile);
      });

      const config = await ctx.run("__load_config__", async () => {
        const configFile = input.configFile ?? "configs/local-weather.yaml";
        return loadConfig(configFile);
      });

      const state: PipelineState = {
        input,
        config,
        steps: {},
      };

      for (const step of pipeline.steps) {
        const output = await ctx.run(step.id, async () => executeStep(step, state));
        state.steps[step.id] = output;
      }

      const prepare = state.steps.prepare_context ?? {};
      const firstAnswer = state.steps.generate_red_tests ?? {};
      const summary = state.steps.validate_red_phase ?? {};
      const final = state.steps.finalize_run ?? {};

      return {
        pipeline_name: pipeline.name,
        config_file: input.configFile ?? "configs/local-weather.yaml",
        sandbox_dir: asString(prepare.sandbox_dir),
        step_1_prompt: asString(prepare.prepared_prompt),
        step_2_opencode_answer: asString(firstAnswer.response_text),
        step_3_explanation: asString(summary.summary_text),
        result_text: asString(final.result_text) || asString(firstAnswer.response_text),
        steps: state.steps,
      };
    },
  },
});

async function executeStep(step: PipelineStep, state: PipelineState): Promise<StepOutput> {
  const params = resolveParams(step.params ?? {}, state) as Record<string, unknown>;

  if (step.type === "prepare_context") {
    return runPrepareContext(params, state);
  }

  if (step.type === "opencode_prompt") {
    return runOpencodePrompt(step.id, params, state);
  }

  if (step.type === "summarize_text") {
    return runSummarizeText(step.id, params, state);
  }

  if (step.type === "finalize_result") {
    return runFinalize(params, state);
  }

  throw new Error(`Unknown step type: ${step.type}`);
}

async function runPrepareContext(params: Record<string, unknown>, state: PipelineState): Promise<StepOutput> {
  const promptFile =
    asString(state.config.prompt_file) || asString(params.prompt_file) || asString(state.input.context?.promptFile) || "prompts/weather.txt";
  const question = asString(state.config.question) || asString(params.question) || asString(state.input.context?.question);
  const promptPath = resolvePath(promptFile);
  const promptText = (await readFile(promptPath, "utf-8")).trim();
  const preparedPrompt = question ? `${promptText}\n\nQuestion: ${question}` : promptText;

  const createSandbox = asBoolean(params.use_sandbox, asBoolean(state.config.use_sandbox, true));
  const cleanupSandbox = asBoolean(params.cleanup_sandbox, asBoolean(state.config.cleanup_sandbox, true));
  const repoRoot = resolveRepoRoot();
  const sandboxDir = createSandbox
    ? await createGitWorktreeSandbox(repoRoot, asString(params.sandbox_prefix) || "nexus-restate-mvp")
    : repoRoot;

  return {
    prompt_file: promptFile,
    prompt_text: promptText,
    question,
    prepared_prompt: preparedPrompt,
    sandbox_dir: sandboxDir,
    cleanup_sandbox: cleanupSandbox,
    used_sandbox: createSandbox,
  };
}

async function runOpencodePrompt(
  stepId: string,
  params: Record<string, unknown>,
  state: PipelineState,
): Promise<StepOutput> {
  const templateConfigKey = asString(params.template_config_key);
  const templateFromConfig = templateConfigKey ? asString(state.config[templateConfigKey]) : "";
  const templateFile = templateFromConfig || asString(params.template_file);
  if (!templateFile) {
    throw new Error(`Step ${stepId} is missing required param 'template_file'`);
  }

  const outputKey = asString(params.output_key) || "response_text";
  const template = await readFile(resolvePath(templateFile), "utf-8");
  const prompt = interpolateTemplate(template, state);
  const workingDirectory =
    asString(params.working_directory) || asString(state.steps.prepare_context?.sandbox_dir) || resolveRepoRoot();
  const response = await askOpencode(prompt, workingDirectory);

  return {
    prompt_template: templateFile,
    prompt,
    working_directory: workingDirectory,
    [outputKey]: response,
  };
}

async function runSummarizeText(
  stepId: string,
  params: Record<string, unknown>,
  state: PipelineState,
): Promise<StepOutput> {
  const sourceStep = asString(params.source_step);
  const sourceKey = asString(params.source_key);
  const outputKey = asString(params.output_key) || "summary_text";

  if (!sourceStep || !sourceKey) {
    throw new Error(`Step ${stepId} requires source_step and source_key params`);
  }

  const sourceValue = asString(state.steps[sourceStep]?.[sourceKey]);
  const summary = summarizeText(sourceValue);

  return {
    source_step: sourceStep,
    source_key: sourceKey,
    [outputKey]: summary,
  };
}

async function runFinalize(params: Record<string, unknown>, state: PipelineState): Promise<StepOutput> {
  const primaryStep = asString(params.primary_step);
  const primaryKey = asString(params.primary_key);
  const summaryStep = asString(params.summary_step);
  const summaryKey = asString(params.summary_key);
  const finalStep = asString(params.final_step);
  const finalKey = asString(params.final_key);

  const primaryText = asString(state.steps[primaryStep]?.[primaryKey]);
  const summaryText = asString(state.steps[summaryStep]?.[summaryKey]);
  const finalText = asString(state.steps[finalStep]?.[finalKey]);

  const sandboxDir = asString(state.steps.prepare_context?.sandbox_dir);
  const usedSandbox = asBoolean(state.steps.prepare_context?.used_sandbox, false);
  const cleanupSandbox = asBoolean(state.steps.prepare_context?.cleanup_sandbox, false);
  let cleanupStatus = "skipped";

  if (usedSandbox && cleanupSandbox && sandboxDir) {
    cleanupStatus = await removeGitWorktreeSandbox(sandboxDir);
  }

  return {
    result_text: finalText || primaryText || summaryText,
    summary_text: summaryText,
    primary_text: primaryText,
    final_text: finalText,
    sandbox_cleanup: cleanupStatus,
  };
}

function summarizeText(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
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

function interpolateTemplate(template: string, state: PipelineState): string {
  return template.replace(/{{\s*([^}]+)\s*}}/g, (_match, expression: string) => {
    const value = resolveExpression(expression.trim(), state);
    return asString(value);
  });
}

function resolveParams(value: unknown, state: PipelineState): unknown {
  if (typeof value === "string") {
    return interpolateTemplate(value, state);
  }

  if (Array.isArray(value)) {
    return value.map((item) => resolveParams(item, state));
  }

  if (typeof value === "object" && value !== null) {
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      next[key] = resolveParams(item, state);
    }
    return next;
  }

  return value;
}

function resolveExpression(expression: string, state: PipelineState): unknown {
  const segments = expression.split(".").filter(Boolean);
  if (segments.length === 0) {
    return "";
  }

  if (segments[0] === "input") {
    return resolvePathValue(state.input, segments.slice(1));
  }

  if (segments[0] === "steps") {
    return resolvePathValue(state.steps, segments.slice(1));
  }

  if (segments[0] === "config") {
    return resolvePathValue(state.config, segments.slice(1));
  }

  return "";
}

function resolvePathValue(root: unknown, segments: string[]): unknown {
  let current: unknown = root;
  for (const segment of segments) {
    if (typeof current !== "object" || current === null) {
      return "";
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

async function loadPipeline(filePath: string): Promise<PipelineDefinition> {
  const absolutePath = resolvePath(filePath);
  const parsed = await loadStructuredFile(absolutePath);
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid pipeline definition: ${filePath}`);
  }

  const name = asString((parsed as Record<string, unknown>).name) || "unnamed-pipeline";
  const stepsValue = (parsed as Record<string, unknown>).steps;
  if (!Array.isArray(stepsValue)) {
    throw new Error(`Pipeline '${name}' must include a 'steps' array`);
  }

  const steps: PipelineStep[] = stepsValue.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new Error(`Pipeline step at index ${index} is invalid`);
    }

    const objectEntry = entry as Record<string, unknown>;
    const id = asString(objectEntry.id);
    const type = asString(objectEntry.type);

    if (!id || !type) {
      throw new Error(`Pipeline step at index ${index} must include id and type`);
    }

    const paramsRaw = objectEntry.params;
    const params = typeof paramsRaw === "object" && paramsRaw !== null ? (paramsRaw as Record<string, unknown>) : {};

    return { id, type, params };
  });

  return { name, steps };
}

async function loadConfig(filePath: string): Promise<Record<string, unknown>> {
  const absolutePath = resolvePath(filePath);
  const parsed = await loadStructuredFile(absolutePath);
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`Invalid config definition: ${filePath}`);
  }
  return parsed as Record<string, unknown>;
}

async function loadStructuredFile(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, "utf-8");
  const extension = extname(filePath).toLowerCase();
  return extension === ".json" ? JSON.parse(raw) : YAML.parse(raw);
}

function resolvePath(filePath: string): string {
  if (isAbsolute(filePath)) {
    return filePath;
  }
  return resolve(process.cwd(), filePath);
}

function asString(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") {
      return true;
    }
    if (value.toLowerCase() === "false") {
      return false;
    }
  }
  return fallback;
}

async function askOpencode(prompt: string, directory: string): Promise<string> {
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
}

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

async function createGitWorktreeSandbox(repoRoot: string, prefix: string): Promise<string> {
  const sandboxDir = await mkdtemp(resolve(tmpdir(), `${prefix}-`));
  await execFileAsync("git", ["worktree", "add", "--detach", sandboxDir, "HEAD"], {
    cwd: repoRoot,
  });
  return sandboxDir;
}

async function removeGitWorktreeSandbox(sandboxDir: string): Promise<string> {
  try {
    await execFileAsync("git", ["worktree", "remove", "--force", sandboxDir], {
      cwd: resolveRepoRoot(),
    });
    return "removed";
  } catch (error) {
    return `remove_failed: ${extractError(error)}`;
  }
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
          };
        }

        runtimePromise = null;
        throw error;
      });
  }

  return runtimePromise;
}

restate.serve({
  services: [workflow],
});
