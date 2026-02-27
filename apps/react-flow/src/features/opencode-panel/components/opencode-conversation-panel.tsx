"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ChevronRight, FileText, GitFork, List, Loader2, Search, SendHorizontal, Terminal, Wrench } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import DOMPurify from "dompurify";
import { Marked } from "marked";
import markedKatex from "marked-katex-extension";
import markedShiki from "marked-shiki";
import { bundledLanguages, codeToHtml, type BundledLanguage } from "shiki";

import {
  createConversationSession,
  listConversations,
  readCachedConversations,
  type ConversationSummary,
} from "@/features/llm-conversation/lib/llm-chat-client";
import { useLlmConversation } from "@/features/llm-conversation/hooks/use-llm-conversation";
import { OpencodeDualChatModal } from "@/features/opencode-panel/components/opencode-dual-chat-modal";
import { OpencodeForkGraphCanvas } from "@/features/opencode-panel/components/opencode-fork-graph-canvas";
import {
  type ChatMessage,
  cloneMessages,
  type ForkSeed,
} from "@/features/opencode-panel/model/chat-types";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent } from "@/shared/ui/dialog";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

const TOOL_PREVIEW_CHAR_LIMIT = 2200;
const TOOL_PREVIEW_LINE_LIMIT = 40;

const OPENCODE_MARKDOWN_THEME = {
  name: "OpenCode",
  type: "dark",
  colors: {
    "editor.background": "transparent",
    "editor.foreground": "var(--md-text)",
    "gitDecoration.addedResourceForeground": "var(--syntax-string)",
    "gitDecoration.deletedResourceForeground": "var(--destructive)",
  },
  tokenColors: [
    { scope: ["comment", "punctuation.definition.comment", "string.comment"], settings: { foreground: "var(--syntax-comment)" } },
    { scope: ["entity.other.attribute-name", "meta.property-name"], settings: { foreground: "var(--syntax-variable)" } },
    { scope: ["constant", "entity.name.constant", "variable.other.constant", "variable.language"], settings: { foreground: "var(--syntax-number)" } },
    { scope: ["entity.name", "meta.export.default", "meta.definition.variable", "support.class.component"], settings: { foreground: "var(--syntax-type)" } },
    { scope: ["entity.name.function", "support.type.primitive", "meta.object.member"], settings: { foreground: "var(--syntax-function)" } },
    { scope: ["keyword", "storage", "storage.type"], settings: { foreground: "var(--syntax-keyword)" } },
    { scope: ["keyword.operator", "storage.type.function.arrow"], settings: { foreground: "var(--syntax-operator)" } },
    { scope: ["string", "punctuation.definition.string"], settings: { foreground: "var(--syntax-string)" } },
    { scope: ["variable", "variable.other"], settings: { foreground: "var(--syntax-variable)" } },
    { scope: ["invalid", "message.error", "markup.deleted"], settings: { foreground: "var(--destructive)" } },
    { scope: ["markup.heading"], settings: { foreground: "var(--md-heading)", fontStyle: "bold" } },
    { scope: ["markup.quote"], settings: { foreground: "var(--md-quote)" } },
  ],
} as const;

const TOKEN_WINDOW_LIMIT = 400_000;
const CODE_MODIFICATION_TOOLS = new Set([
  "apply_patch",
  "edit",
  "write",
  "serena_replace_content",
  "serena_replace_symbol_body",
  "serena_insert_after_symbol",
  "serena_insert_before_symbol",
  "serena_rename_symbol",
]);

function tryParseJson(value: string): unknown | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function extractPatchText(tool: string, input?: string, output?: string): string | null {
  const normalizedTool = tool.trim().toLowerCase();
  const inputText = (input ?? "").trim();
  const outputText = (output ?? "").trim();

  if (normalizedTool === "apply_patch") {
    const parsedInput = tryParseJson(inputText);
    if (parsedInput && typeof parsedInput === "object" && !Array.isArray(parsedInput)) {
      const patchText = (parsedInput as { patchText?: unknown }).patchText;
      if (typeof patchText === "string" && patchText.trim().length > 0) {
        return patchText;
      }
    }

    if (inputText.includes("*** Begin Patch") || inputText.includes("@@") || inputText.includes("diff --git")) {
      return inputText;
    }
  }

  if (inputText.includes("diff --git") || inputText.includes("@@")) {
    return inputText;
  }

  if (outputText.includes("diff --git") || outputText.includes("@@")) {
    return outputText;
  }

  return null;
}

function CodeModificationDiffView({ tool, input, output }: { tool: string; input?: string; output?: string }) {
  const patch = extractPatchText(tool, input, output);

  if (!patch) {
    return <ToolPreview text={output} emptyText="Code change completed successfully with no output." />;
  }

  return <ToolPreview text={patch} emptyText="Code change completed successfully with no output." />;
}

function ToolPreview({ text, emptyText }: { text?: string; emptyText?: string }) {
  const [expanded, setExpanded] = useState(false);
  const resolved = (text ?? "").trim();

  if (resolved.length === 0) {
    return emptyText ? <p className="text-[11px] text-muted-foreground">{emptyText}</p> : null;
  }

  const lines = resolved.split(/\r?\n/);
  const needsTruncation = lines.length > TOOL_PREVIEW_LINE_LIMIT || resolved.length > TOOL_PREVIEW_CHAR_LIMIT;
  const truncatedByLines = lines.slice(0, TOOL_PREVIEW_LINE_LIMIT).join("\n");
  const truncated = truncatedByLines.length > TOOL_PREVIEW_CHAR_LIMIT
    ? `${truncatedByLines.slice(0, TOOL_PREVIEW_CHAR_LIMIT)}\n...`
    : `${truncatedByLines}${lines.length > TOOL_PREVIEW_LINE_LIMIT ? "\n..." : ""}`;
  const displayText = needsTruncation && !expanded ? truncated : resolved;

  return (
    <div className="space-y-1">
      <pre className="max-h-52 overflow-auto whitespace-pre-wrap break-words border border-border/50 bg-background/70 p-2 text-[11px] text-foreground [overflow-wrap:anywhere]">
        {displayText}
      </pre>
      {needsTruncation ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="text-[11px] font-medium text-primary underline-offset-2 hover:underline"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}

function ListToolView({ text, title, icon }: { text?: string; title: string; icon: ReactNode }) {
  const entries = (text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (entries.length === 0) {
    return <p className="text-[11px] text-muted-foreground">No entries returned.</p>;
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      <ul className="max-h-52 space-y-1 overflow-auto border border-border/50 bg-background/70 p-2 text-[11px] text-foreground">
        {entries.map((entry, index) => (
          <li key={`${entry}-${index}`} className="break-words [overflow-wrap:anywhere]">
            {entry}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ToolOutputView({ tool, input, text, isError = false }: { tool: string; input?: string; text?: string; isError?: boolean }) {
  const normalizedTool = tool.trim().toLowerCase();

  if (CODE_MODIFICATION_TOOLS.has(normalizedTool)) {
    return <CodeModificationDiffView tool={tool} input={input} output={text} />;
  }

  if (normalizedTool === "bash") {
    const output = (text ?? "").trim();
    const hasErrorSignals =
      isError || /(?:\n|^)(error|stderr|exit\s*code\s*:\s*[1-9]|failed)(?:\b|:)/i.test(output);
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Terminal className="h-3.5 w-3.5" />
          <span>{hasErrorSignals ? "Command output (issues detected)" : "Command output"}</span>
        </div>
        <ToolPreview text={text} emptyText="Tool completed successfully with no output." />
      </div>
    );
  }

  if (normalizedTool === "glob") {
    return <ListToolView text={text} title="Matched files" icon={<List className="h-3.5 w-3.5" />} />;
  }

  if (normalizedTool === "grep") {
    return <ListToolView text={text} title="Search matches" icon={<Search className="h-3.5 w-3.5" />} />;
  }

  if (normalizedTool === "read" || normalizedTool === "write" || normalizedTool === "edit") {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <FileText className="h-3.5 w-3.5" />
          <span>File operation output</span>
        </div>
        <ToolPreview text={text} emptyText="Tool completed successfully with no output." />
      </div>
    );
  }

  if (normalizedTool === "todowrite") {
    const parsed = tryParseJson(text ?? "");
    const todos =
      parsed && typeof parsed === "object" && !Array.isArray(parsed) && Array.isArray((parsed as { todos?: unknown }).todos)
        ? ((parsed as { todos: Array<{ content?: unknown; status?: unknown }> }).todos)
            .map((todo) => ({
              content: typeof todo.content === "string" ? todo.content.trim() : "",
              status: typeof todo.status === "string" ? todo.status.trim() : "pending",
            }))
            .filter((todo) => todo.content.length > 0)
        : [];

    if (todos.length > 0) {
      return (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Task list</p>
          <ul className="space-y-1 border border-border/50 bg-background/70 p-2 text-[11px] text-foreground">
            {todos.map((todo, index) => (
              <li key={`${todo.content}-${index}`} className="flex items-start justify-between gap-2">
                <span className="break-words [overflow-wrap:anywhere]">{todo.content}</span>
                <span className="bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{todo.status}</span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
  }

  return <ToolPreview text={text} emptyText="Tool completed successfully with no output." />;
}

function iconForToolName(tool: string): ReactNode {
  const normalizedTool = tool.trim().toLowerCase();
  if (normalizedTool === "bash") {
    return <Terminal className="h-3.5 w-3.5 text-muted-foreground" />;
  }
  if (normalizedTool === "glob") {
    return <List className="h-3.5 w-3.5 text-muted-foreground" />;
  }
  if (normalizedTool === "grep") {
    return <Search className="h-3.5 w-3.5 text-muted-foreground" />;
  }
  if (normalizedTool === "read" || normalizedTool === "write" || normalizedTool === "edit") {
    return <FileText className="h-3.5 w-3.5 text-muted-foreground" />;
  }
  return <Wrench className="h-3.5 w-3.5 text-muted-foreground" />;
}

function MarkdownMessage({ text }: { text: string }) {
  const parser = useMemo(() => {
    const instance = new Marked({ gfm: true });
    instance.use(
      {
        renderer: {
          link({ href, title, text: linkText }) {
            const titleAttr = title ? ` title="${title}"` : "";
            return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${linkText}</a>`;
          },
        },
      },
      markedKatex({
        throwOnError: false,
        nonStandard: true,
      }),
      markedShiki({
        async highlight(code, lang) {
          const nextLang = lang && lang.trim().length > 0 ? lang : "text";
          const resolvedLang = (nextLang in bundledLanguages ? nextLang : "text") as BundledLanguage;
          try {
            return await codeToHtml(code, {
              lang: resolvedLang,
              theme: OPENCODE_MARKDOWN_THEME as never,
            });
          } catch {
            return await codeToHtml(code, {
              lang: "text",
              theme: OPENCODE_MARKDOWN_THEME as never,
            });
          }
        },
      }),
    );

    return instance;
  }, []);
  const [html, setHtml] = useState("");

  useEffect(() => {
    let cancelled = false;

    const render = async () => {
      const parsed = await parser.parse(text);
      const safe = DOMPurify.sanitize(parsed, {
        USE_PROFILES: { html: true, mathMl: true },
        SANITIZE_NAMED_PROPS: true,
        FORBID_TAGS: ["style"],
        FORBID_CONTENTS: ["style", "script"],
      });
      if (!cancelled) {
        setHtml(safe);
      }
    };

    void render();

    return () => {
      cancelled = true;
    };
  }, [parser, text]);

  return (
    <div
      className="opencode-markdown min-w-0 max-w-full overflow-x-hidden break-words [overflow-wrap:anywhere] text-sm leading-relaxed [color:var(--md-text)] [&_*]:min-w-0 [&_*]:max-w-full [&_*]:break-words [&_*]:[overflow-wrap:anywhere] [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5 [&_li]:min-w-0 [&_h1]:[color:var(--md-heading)] [&_h2]:[color:var(--md-heading)] [&_h3]:[color:var(--md-heading)] [&_blockquote]:mb-3 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:[color:var(--md-quote)] [&_pre]:mb-3 [&_pre]:min-w-0 [&_pre]:w-full [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:p-2 [&_pre]:text-[13px] [&_pre]:leading-relaxed [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_code]:[color:var(--md-code)] [&_strong]:[color:var(--md-strong)] [&_em]:[color:var(--md-emph)] [&_table]:min-w-full [&_table]:border-collapse [&_table]:text-left [&_table]:text-xs [&_th]:border-b [&_th]:border-border/60 [&_th]:px-2 [&_th]:py-1.5 [&_th]:font-medium [&_td]:border-b [&_td]:border-border/40 [&_td]:px-2 [&_td]:py-1.5 [&_a]:[color:var(--md-link)] [&_a]:underline [&_a]:underline-offset-2"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

interface OpencodeConversationPanelProps {
  className?: string;
  autoStartNewConversation?: boolean;
  disableShortcutModal?: boolean;
  activeConversationId?: string | null;
  onActiveConversationChange?: (conversationId: string | null) => void;
}

interface OpencodeConversationThreadProps {
  messages: ChatMessage[];
  emptyText: string;
  testIdPrefix?: string;
  onForkUserMessage?: (messageId: string) => void;
}

function formatMessageTimestamp(timestamp?: number): string | null {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return null;
  }

  return new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function estimateConversationTokens(messages: ChatMessage[]): number {
  const chars = messages.reduce((sum, message) => {
    const messageChars = message.content.length;
    const toolChars = message.toolCalls.reduce((toolSum, toolCall) => {
      return (
        toolSum +
        toolCall.tool.length +
        (toolCall.title?.length ?? 0) +
        (toolCall.input?.length ?? 0) +
        (toolCall.output?.length ?? 0) +
        (toolCall.error?.length ?? 0)
      );
    }, 0);

    return sum + messageChars + toolChars;
  }, 0);

  return Math.max(0, Math.round(chars / 4));
}

export function OpencodeConversationThread({
  messages,
  emptyText,
  testIdPrefix = "opencode-message",
  onForkUserMessage,
}: OpencodeConversationThreadProps) {
  if (messages.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  const toolTimestampHeaderKeys = new Set<string>();
  let previousToolTimestampLabel: string | null = null;

  messages.forEach((message, messageIndex) => {
    const timestampLabel = formatMessageTimestamp(message.createdAt);
    if (!timestampLabel) {
      return;
    }

    message.toolCalls.forEach((_, toolIndex) => {
      const key = `${messageIndex}-${toolIndex}`;
      if (timestampLabel !== previousToolTimestampLabel) {
        toolTimestampHeaderKeys.add(key);
        previousToolTimestampLabel = timestampLabel;
      }
    });
  });

  return (
    <div className="space-y-3">
      {messages.map((message, messageIndex) => {
        const assistantToolOnly = message.role === "assistant" && message.content.trim().length === 0 && message.toolCalls.length > 0;

        return (
          <div
            key={message.id}
            data-testid={`${testIdPrefix}-${message.role}`}
            data-chat-message-id={message.id}
            data-chat-message-role={message.role}
            className={cn(
              "text-sm",
              message.role === "user"
                ? "relative border-l-4 border-l-primary bg-[#202020] py-2 pl-3 pr-10 text-foreground"
                : "px-0 py-0 text-card-foreground",
            )}
          >
            {message.role === "user" && onForkUserMessage ? (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute right-2 top-2 h-6 w-6"
                onClick={() => onForkUserMessage(message.id)}
                aria-label="Fork from this message"
                title="Fork from this message"
              >
                <GitFork className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          {message.content.trim().length > 0 ? (
            message.role === "assistant" ? (
              <MarkdownMessage text={message.content} />
            ) : (
              <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
            )
          ) : message.toolCalls.length === 0 ? (
            <p className="text-sm text-muted-foreground">(empty)</p>
          ) : null}
          {message.toolCalls.length > 0 ? (
            <div className={cn("space-y-2", assistantToolOnly ? "mt-0" : "mt-2")} data-testid="opencode-tool-calls">
              {message.toolCalls.map((toolCall, toolIndex) => (
                <details key={toolCall.callId} className="group rounded-sm border border-border/60 bg-[var(--opencode-conversation-bg)]">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-2 py-2 text-xs font-medium text-foreground">
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-open:rotate-90" />
                    {iconForToolName(toolCall.tool)}
                    <span className="truncate text-sm">Tool Use: {toolCall.title ?? toolCall.tool}</span>
                    {toolTimestampHeaderKeys.has(`${messageIndex}-${toolIndex}`) ? (
                      <span className="ml-auto shrink-0 text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                        {formatMessageTimestamp(message.createdAt)}
                      </span>
                    ) : null}
                  </summary>
                  <div
                    className={cn(
                      "space-y-2 border-t border-border/60 p-2 text-xs text-muted-foreground",
                      toolCall.status === "error" || Boolean(toolCall.error)
                        ? "bg-destructive/10"
                        : toolCall.status === "completed"
                          ? "bg-muted/20"
                          : "",
                    )}
                    data-testid="opencode-tool-call-item"
                  >
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em]">Input</p>
                      <ToolPreview text={toolCall.input} emptyText="Tool input was not captured." />
                    </div>
                    <div>
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em]">Output</p>
                      <ToolOutputView
                        tool={toolCall.tool}
                        input={toolCall.input}
                        text={toolCall.output}
                        isError={toolCall.status === "error" || Boolean(toolCall.error)}
                      />
                    </div>
                    {toolCall.error ? (
                      <p className="border border-destructive/50 bg-destructive/15 p-2 text-destructive">{toolCall.error}</p>
                    ) : null}
                  </div>
                </details>
              ))}
            </div>
          ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function OpencodeConversationPanel({
  className,
  autoStartNewConversation = false,
  disableShortcutModal = false,
  activeConversationId,
  onActiveConversationChange,
}: OpencodeConversationPanelProps) {
  const [internalConversationId, setInternalConversationId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [panelErrorMessage, setPanelErrorMessage] = useState<string | null>(null);
  const [isShortcutModalOpen, setIsShortcutModalOpen] = useState(false);
  const [shortcutModalSeed, setShortcutModalSeed] = useState(0);
  const [isParallelModalOpen, setIsParallelModalOpen] = useState(false);
  const [parallelModalSeed, setParallelModalSeed] = useState(0);
  const [isForkModalOpen, setIsForkModalOpen] = useState(false);
  const [forkModalSeed, setForkModalSeed] = useState(0);
  const [forkSeed, setForkSeed] = useState<ForkSeed | null>(null);
  const [isForkGraphOpen, setIsForkGraphOpen] = useState(false);
  const lastShortcutAtRef = useRef(0);
  const transcriptScrollRootRef = useRef<HTMLDivElement | null>(null);
  const draftTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showScrollToLatest, setShowScrollToLatest] = useState(false);
  const [pendingScrollToBottomOnLoad, setPendingScrollToBottomOnLoad] = useState(true);
  const [stickyUserMessage, setStickyUserMessage] = useState<ChatMessage | null>(null);
  const queryClient = useQueryClient();
  const conversationId = activeConversationId !== undefined ? activeConversationId : internalConversationId;

  const conversationsQuery = useQuery<ConversationSummary[]>({
    queryKey: ["opencode", "conversations"],
    queryFn: listConversations,
    staleTime: 0,
    initialData: () => {
      const cached = readCachedConversations();
      return cached.length > 0 ? cached : undefined;
    },
  });
  const conversations = conversationsQuery.data ?? [];

  const updateConversationId = useCallback(
    (nextConversationId: string | null) => {
      if (activeConversationId === undefined) {
        setInternalConversationId(nextConversationId);
      }
      onActiveConversationChange?.(nextConversationId);
    },
    [activeConversationId, onActiveConversationChange],
  );

  const {
    messages,
    isLoading,
    isRefreshing,
    isSending,
    errorMessage: conversationErrorMessage,
    sendMessage,
    reload,
    setMessages,
  } = useLlmConversation({
    conversationId,
    onConversationIdChange: updateConversationId,
  });

  const errorMessage = panelErrorMessage ?? conversationErrorMessage;

  const canSend = draft.trim().length > 0 && !isSending;

  const loadConversations = useCallback(async () => {
    const loadedConversations = await queryClient.fetchQuery({
      queryKey: ["opencode", "conversations"],
      queryFn: listConversations,
    });
    return loadedConversations;
  }, [queryClient]);

  const subtitle = useMemo(() => {
    if (!conversationId) {
      return "No active conversation";
    }

    const activeConversation = conversations.find((item) => item.id === conversationId);
    if (!activeConversation) {
      return `Conversation ${conversationId.slice(0, 8)}`;
    }

    return activeConversation.title;
  }, [conversationId, conversations]);

  const estimatedTokensUsed = useMemo(() => estimateConversationTokens(messages), [messages]);
  const tokenUsagePercent = useMemo(() => {
    if (TOKEN_WINDOW_LIMIT <= 0) {
      return 0;
    }

    return Math.min(100, Math.round((estimatedTokensUsed / TOKEN_WINDOW_LIMIT) * 100));
  }, [estimatedTokensUsed]);
  const tokenRemainingPercent = Math.max(0, 100 - tokenUsagePercent);

  const openForkModal = useCallback(() => {
    if (!conversationId) {
      setPanelErrorMessage("Start or select a conversation before forking.");
      return;
    }

    const activeConversation = conversations.find((entry) => entry.id === conversationId);
    setForkSeed({
      sourceConversationId: conversationId,
      sourceTitle: activeConversation?.title ?? `Conversation ${conversationId.slice(0, 8)}`,
      sourceMessages: cloneMessages(messages),
    });
    setForkModalSeed((current) => current + 1);
    setIsForkModalOpen(true);
  }, [conversationId, conversations, messages]);

  const openForkFromMessage = useCallback(
    (messageId: string) => {
      if (!conversationId) {
        setPanelErrorMessage("Start or select a conversation before forking.");
        return;
      }

      const activeConversation = conversations.find((entry) => entry.id === conversationId);
      const targetIndex = messages.findIndex((entry) => entry.id === messageId);
      const sourceMessages = targetIndex >= 0 ? cloneMessages(messages.slice(0, targetIndex + 1)) : cloneMessages(messages);

      setForkSeed({
        sourceConversationId: conversationId,
        sourceTitle: activeConversation?.title ?? `Conversation ${conversationId.slice(0, 8)}`,
        sourceMessages,
      });
      setForkModalSeed((current) => current + 1);
      setIsForkModalOpen(true);
    },
    [conversationId, conversations, messages],
  );

  const startNewConversation = useCallback(async () => {
    setPanelErrorMessage(null);
    try {
      const payload = await createConversationSession();
      updateConversationId(payload.id);
      setMessages([]);
      const loaded = await loadConversations();
      if (loaded.length > 0) {
        const createdConversation = loaded.find((item) => item.id === payload.id);
        if (createdConversation) {
          updateConversationId(createdConversation.id);
        }
      }
    } catch (error) {
      setPanelErrorMessage(error instanceof Error ? error.message : "Failed to start conversation");
    }
  }, [loadConversations, setMessages]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const loaded = await loadConversations();
        if (cancelled || loaded.length === 0) {
          return;
        }

        const latest = loaded[0];
        if (!latest) {
          return;
        }

        if (!conversationId) {
          updateConversationId(latest.id);
        }
      } catch (error) {
        if (!cancelled) {
          setPanelErrorMessage(error instanceof Error ? error.message : "Failed to initialize OpenCode panel");
        }
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [conversationId, loadConversations, updateConversationId]);

  useEffect(() => {
    if (!autoStartNewConversation) {
      return;
    }

    void startNewConversation();
  }, [autoStartNewConversation, startNewConversation]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) {
        return;
      }

      if (event.repeat) {
        return;
      }

      const now = Date.now();
      if (now - lastShortcutAtRef.current < 150) {
        return;
      }
      lastShortcutAtRef.current = now;

      const key = event.key.toLowerCase();
      if (key === "n" && !disableShortcutModal) {
        event.preventDefault();
        setShortcutModalSeed((current) => current + 1);
        setIsShortcutModalOpen(true);
        return;
      }

      if (key === "a" && !disableShortcutModal) {
        event.preventDefault();
        setParallelModalSeed((current) => current + 1);
        setIsParallelModalOpen(true);
        return;
      }

      if (key === "s") {
        event.preventDefault();
        openForkModal();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [disableShortcutModal, openForkModal]);

  const handleSendMessage = async () => {
    const nextDraft = draft.trim();
    if (!nextDraft) {
      return;
    }

    setPanelErrorMessage(null);
    setDraft("");
    await sendMessage(nextDraft);
    await queryClient.invalidateQueries({ queryKey: ["opencode", "conversations"] });
  };

  useEffect(() => {
    const viewport = transcriptScrollRootRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
    if (!viewport) {
      return;
    }

    const update = () => {
      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      setShowScrollToLatest(distanceFromBottom > 24);
    };

    update();
    viewport.addEventListener("scroll", update, { passive: true });

    return () => {
      viewport.removeEventListener("scroll", update);
    };
  }, [messages.length]);

  const scrollToLastMessage = () => {
    const viewport = transcriptScrollRootRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
    if (!viewport) {
      return;
    }

    viewport.scrollTo({
      top: viewport.scrollHeight,
      behavior: "smooth",
    });
  };

  const scrollToBottomImmediate = useCallback(() => {
    const viewport = transcriptScrollRootRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
    if (!viewport) {
      return;
    }

    viewport.scrollTop = viewport.scrollHeight;
  }, []);

  const resizeDraftTextarea = useCallback(() => {
    const textarea = draftTextareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = "auto";
    const nextHeight = Math.min(textarea.scrollHeight, 220);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > nextHeight ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    resizeDraftTextarea();
  }, [draft, resizeDraftTextarea]);

  useEffect(() => {
    setPendingScrollToBottomOnLoad(true);
  }, [conversationId]);

  useEffect(() => {
    if (!pendingScrollToBottomOnLoad) {
      return;
    }

    if (isLoading || isRefreshing) {
      return;
    }

    let secondFrame: number | null = null;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        scrollToBottomImmediate();
        setPendingScrollToBottomOnLoad(false);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [isLoading, isRefreshing, messages.length, pendingScrollToBottomOnLoad, scrollToBottomImmediate]);

  useEffect(() => {
    const viewport = transcriptScrollRootRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
    if (!viewport) {
      setStickyUserMessage(null);
      return;
    }

    const updateStickyAnchor = () => {
      const viewportRect = viewport.getBoundingClientRect();
      const visibleUserIndices = messages
        .map((message, index) => ({ message, index }))
        .filter(({ message }) => message.role === "user" && message.content.trim().length > 0)
        .filter(({ message }) => {
          const selector = `[data-chat-message-id=\"${message.id}\"]`;
          const target = viewport.querySelector(selector) as HTMLElement | null;
          if (!target) {
            return false;
          }

          const targetRect = target.getBoundingClientRect();
          return targetRect.bottom > viewportRect.top && targetRect.top < viewportRect.bottom;
        })
        .map(({ index }) => index)
        .sort((a, b) => a - b);

      const firstVisibleUserIndex = visibleUserIndices.length > 0 ? visibleUserIndices[0] : -1;
      if (firstVisibleUserIndex <= 0) {
        setStickyUserMessage(null);
        return;
      }

      for (let index = firstVisibleUserIndex - 1; index >= 0; index -= 1) {
        const candidate = messages[index];
        if (candidate.role === "user" && candidate.content.trim().length > 0) {
          setStickyUserMessage(candidate);
          return;
        }
      }

      setStickyUserMessage(null);
    };

    updateStickyAnchor();
    viewport.addEventListener("scroll", updateStickyAnchor, { passive: true });
    window.addEventListener("resize", updateStickyAnchor);

    return () => {
      viewport.removeEventListener("scroll", updateStickyAnchor);
      window.removeEventListener("resize", updateStickyAnchor);
    };
  }, [messages]);

  return (
    <>
      <aside
        data-testid="opencode-panel"
        className={cn("flex h-full min-h-0 w-full flex-col border-l border-border/80 bg-card/70 p-3", className)}
      >
      <div className="border border-border/70 bg-[var(--opencode-conversation-bg)] p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 truncate text-sm font-semibold text-foreground">{subtitle}</p>
          <div className="flex shrink-0 items-center gap-2">
            {conversationsQuery.isFetching || isLoading || isRefreshing ? (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] text-muted-foreground" data-testid="opencode-panel-syncing-indicator">
                <Loader2 className="h-3 w-3 animate-spin" />
                Syncing latest
              </span>
            ) : null}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center bg-transparent"
                  aria-label="Token usage"
                  title="Token usage"
                >
                  <span
                    className="relative inline-block h-4 w-4"
                    style={{
                      background: `conic-gradient(var(--color-primary) ${tokenUsagePercent}%, var(--color-border) ${tokenUsagePercent}% 100%)`,
                    }}
                  >
                    <span className="absolute inset-[3px] bg-card" />
                  </span>
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="font-medium">{tokenRemainingPercent}% remaining</p>
                <p className="text-muted-foreground">{estimatedTokensUsed.toLocaleString()} / {TOKEN_WINDOW_LIMIT.toLocaleString()} tokens used</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <div className="relative mt-3 min-h-0 flex-1 bg-[var(--opencode-conversation-bg)]">
        <ScrollArea ref={transcriptScrollRootRef} className="h-full w-full">
          <div className="p-3">
            <OpencodeConversationThread
              messages={messages}
              emptyText="Start a conversation and ask OpenCode about this project."
              testIdPrefix="opencode-message"
              onForkUserMessage={openForkFromMessage}
            />
          </div>
        </ScrollArea>
        {stickyUserMessage ? (
          <div className="pointer-events-none absolute left-1 right-1 top-2 z-30 border border-border/80 bg-muted px-3 py-2 text-xs text-foreground shadow-md">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Last user message</p>
            <p
              className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {stickyUserMessage.content}
            </p>
          </div>
        ) : null}
        {showScrollToLatest ? (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute bottom-3 right-3 z-10 h-8 w-8 border border-border/70 bg-background/95 shadow-sm"
            data-testid="opencode-scroll-latest"
            aria-label="Scroll to latest message"
            title="Scroll to latest message"
            onClick={scrollToLastMessage}
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="mt-3 border bg-[var(--opencode-conversation-bg)] p-3 shadow-sm" style={{ borderColor: "var(--opencode-composer-border)" }}>
        <textarea
          ref={draftTextareaRef}
          data-testid="opencode-draft"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onInput={resizeDraftTextarea}
          rows={1}
          placeholder="Plan, @ for context, / for commands"
          className="w-full resize-none bg-transparent px-1 py-1 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground/60"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (canSend) {
                void handleSendMessage();
              }
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Enter to send, Shift+Enter for new line</p>
          <Button
            data-testid="opencode-send"
            type="button"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleSendMessage}
            disabled={!canSend}
            aria-label="Send"
            title="Send"
          >
            <SendHorizontal className="h-3.5 w-3.5" />
          </Button>
        </div>
        {errorMessage ? <p className="mt-2 text-xs text-amber-300">{errorMessage}</p> : null}
      </div>
      </aside>

      {disableShortcutModal ? null : (
        <>
          <Dialog open={isShortcutModalOpen} onOpenChange={setIsShortcutModalOpen}>
            <DialogContent className="h-[88vh] w-[84vw] max-w-[1300px] p-0">
              <OpencodeConversationPanel
                key={`shortcut-new-chat-${shortcutModalSeed}`}
                autoStartNewConversation
                disableShortcutModal
                className="h-full border-l-0 p-4"
              />
            </DialogContent>
          </Dialog>

          <Dialog open={isParallelModalOpen} onOpenChange={setIsParallelModalOpen}>
            <DialogContent className="h-[88vh] w-[92vw] max-w-[1500px] p-0">
              <OpencodeDualChatModal key={`shortcut-parallel-chat-${parallelModalSeed}`} />
            </DialogContent>
          </Dialog>

          <Dialog
            open={isForkModalOpen}
            onOpenChange={(open) => {
              setIsForkModalOpen(open);
              if (!open) {
                setForkSeed(null);
              }
            }}
          >
            <DialogContent className="h-[88vh] w-[92vw] max-w-[1500px] p-0">
              {forkSeed ? <OpencodeDualChatModal key={`shortcut-fork-chat-${forkModalSeed}`} forkSeed={forkSeed} /> : null}
            </DialogContent>
          </Dialog>

          <Dialog open={isForkGraphOpen} onOpenChange={setIsForkGraphOpen}>
            <DialogContent className="h-[88vh] w-[92vw] max-w-[1500px] p-0">
              <OpencodeForkGraphCanvas />
            </DialogContent>
          </Dialog>
        </>
      )}
    </>
  );
}
