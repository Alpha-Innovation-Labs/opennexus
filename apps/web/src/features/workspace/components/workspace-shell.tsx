"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Moon, Sun } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import type {
  LiveSessionSnapshot,
  NextActionRow,
  TaskStatusSnapshot,
  WorkspaceFile,
} from "@/entities/workspace/types";
import {
  WorkspaceApiRequestError,
  fetchLiveStream,
  fetchNextActions,
  fetchTaskStatus,
  listWorkspaceFiles,
  loadWorkspaceFile,
  saveWorkspaceFile,
  startRowExecution,
} from "@/features/workspace/api/client";
import { cn } from "@/shared/lib/cn";

type FileTreeNode = {
  id: string;
  label: string;
  path?: string;
  children: FileTreeNode[];
};

type MarkdownSections = {
  frontmatter: string;
  body: string;
};

function splitFrontmatter(markdown: string): MarkdownSections {
  const match = markdown.match(/^---\n[\s\S]*?\n---\n?/);
  if (!match) {
    return { frontmatter: "", body: markdown };
  }
  return {
    frontmatter: match[0].trimEnd(),
    body: markdown.slice(match[0].length).replace(/^\n+/, ""),
  };
}

function composeMarkdown(frontmatter: string, body: string): string {
  const normalizedBody = body.trimEnd();
  if (!frontmatter.trim()) {
    return normalizedBody ? `${normalizedBody}\n` : "";
  }
  if (!normalizedBody) {
    return `${frontmatter}\n`;
  }
  return `${frontmatter}\n\n${normalizedBody}\n`;
}

function buildFileTree(files: WorkspaceFile[]): FileTreeNode[] {
  const roots = new Map<string, FileTreeNode>();

  for (const file of files) {
    const parts = file.path.split("/");
    if (parts.length === 0) {
      continue;
    }
    const project = parts[3] ?? "unknown";
    const feature = parts[4] ?? "misc";

    const rootId = `${file.group}:${project}`;
    if (!roots.has(rootId)) {
      roots.set(rootId, {
        id: rootId,
        label: `${project}`,
        children: [],
      });
    }
    const rootNode = roots.get(rootId)!;

    const featureId = `${rootId}:${feature}`;
    let featureNode = rootNode.children.find((node) => node.id === featureId);
    if (!featureNode) {
      featureNode = {
        id: featureId,
        label: feature,
        children: [],
      };
      rootNode.children.push(featureNode);
    }

    featureNode.children.push({
      id: file.path,
      label: file.name,
      path: file.path,
      children: [],
    });
  }

  return Array.from(roots.values())
    .sort((left, right) => left.label.localeCompare(right.label))
    .map((projectNode) => ({
      ...projectNode,
      children: projectNode.children
        .sort((left, right) => left.label.localeCompare(right.label))
        .map((featureNode) => ({
          ...featureNode,
          children: featureNode.children.sort((left, right) => left.label.localeCompare(right.label)),
        })),
    }));
}

function displayTimestamp(timestamp: number | null): string {
  if (!timestamp) {
    return "n/a";
  }
  return new Date(timestamp * 1000).toLocaleString();
}

function statusVariant(status: TaskStatusSnapshot["status"]): "success" | "destructive" | "warning" | "secondary" {
  if (status === "implemented") {
    return "success";
  }
  if (status === "failed") {
    return "destructive";
  }
  if (status === "missing") {
    return "warning";
  }
  return "secondary";
}

export function WorkspaceShell() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [contextFile, setContextFile] = useState("");
  const [contextId, setContextId] = useState("");
  const [rows, setRows] = useState<NextActionRow[]>([]);
  const [selectedTestId, setSelectedTestId] = useState("");
  const [status, setStatus] = useState<TaskStatusSnapshot | null>(null);
  const [liveStream, setLiveStream] = useState<LiveSessionSnapshot | null>(null);
  const [actionMessage, setActionMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [editorMode, setEditorMode] = useState(false);
  const [frontmatter, setFrontmatter] = useState("");
  const [body, setBody] = useState("");
  const [mtimeMs, setMtimeMs] = useState<number | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const loadedPathRef = useRef<string>("");

  const requestedPath = searchParams?.get("path")?.trim() || "";

  const updateQueryPath = (nextPath: string) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (nextPath) {
      params.set("path", nextPath);
    } else {
      params.delete("path");
    }
    const query = params.toString();
    const url = query.length > 0 ? `${pathname}?${query}` : pathname;
    router.replace(url, { scroll: false });
  };

  const contextFiles = useMemo(() => files.filter((file) => file.group === "context"), [files]);
  const fileTree = useMemo(() => buildFileTree(contextFiles), [contextFiles]);

  useEffect(() => {
    void (async () => {
      try {
        const listed = await listWorkspaceFiles();
        setFiles(listed);
        const firstContext = requestedPath
          ? listed.find((file) => file.path === requestedPath)
          : listed.find((file) => file.group === "context");
        if (firstContext) {
          setContextFile(firstContext.path);
          if (!requestedPath) {
            updateQueryPath(firstContext.path);
          }
        }
      } catch (error) {
        setFilesError(error instanceof Error ? error.message : "Unable to list markdown files.");
      }
    })();
  }, []);

  useEffect(() => {
    if (!requestedPath || requestedPath === contextFile) {
      return;
    }
    if (files.some((file) => file.path === requestedPath)) {
      setContextFile(requestedPath);
    }
  }, [contextFile, files, requestedPath]);

  useEffect(() => {
    if (!contextFile) {
      return;
    }
    if (hasUnsavedChanges && loadedPathRef.current && loadedPathRef.current !== contextFile) {
      const proceed = window.confirm("You have unsaved markdown changes. Switch files and discard edits?");
      if (!proceed) {
        setContextFile(loadedPathRef.current);
        updateQueryPath(loadedPathRef.current);
        return;
      }
    }

    setLoadingFile(true);
    void (async () => {
      try {
        const [rowPayload, filePayload] = await Promise.all([
          fetchNextActions(contextFile),
          loadWorkspaceFile(contextFile),
        ]);
        const parts = splitFrontmatter(filePayload.content);
        setContextId(rowPayload.contextId);
        setRows(rowPayload.rows);
        setSelectedTestId(rowPayload.rows[0]?.testId ?? "");
        setActionMessage("");
        setFrontmatter(parts.frontmatter);
        setBody(parts.body);
        setMtimeMs(filePayload.file.mtimeMs);
        setHasUnsavedChanges(false);
        setHasConflict(false);
        setSaveState("idle");
        setSaveMessage("");
        loadedPathRef.current = contextFile;
      } catch (error) {
        setActionMessage(error instanceof Error ? error.message : "Unable to load selected file.");
      } finally {
        setLoadingFile(false);
      }
    })();
  }, [contextFile]);

  useEffect(() => {
    if (!selectedTestId || !contextId || !contextFile) {
      return;
    }

    let interval: ReturnType<typeof setInterval> | null = null;
    const guardedRefresh = async () => {
      const [statusPayload, streamPayload] = await Promise.all([
        fetchTaskStatus(contextId, selectedTestId),
        fetchLiveStream(contextFile, selectedTestId),
      ]);
      setStatus(statusPayload);
      setLiveStream(streamPayload);
      if (!streamPayload.active && interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    void guardedRefresh();
    interval = setInterval(() => {
      void guardedRefresh();
    }, 2000);
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [contextFile, contextId, selectedTestId]);

  useEffect(() => {
    const root = document.documentElement;
    const stored = window.localStorage.getItem("cdd-web-theme");
    const preferredDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme = stored === "dark" || (stored !== "light" && preferredDark) ? "dark" : "light";
    root.classList.toggle("dark", nextTheme === "dark");
    setTheme(nextTheme);
  }, []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) {
        return;
      }
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedChanges]);

  const rowOptions = rows.map((row) => ({
    value: row.testId,
    label: `${row.testId} - ${row.description}`,
  }));

  const selectedRowDescription = rows.find((row) => row.testId === selectedTestId)?.description ?? "";

  const selectedFileMeta = files.find((file) => file.path === contextFile) ?? null;

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    window.localStorage.setItem("cdd-web-theme", nextTheme);
    setTheme(nextTheme);
  };

  const saveCurrentFile = async () => {
    if (!contextFile) {
      return;
    }
    setSaveState("saving");
    setSaveMessage("Saving markdown...");
    try {
      const payload = await saveWorkspaceFile({
        path: contextFile,
        content: composeMarkdown(frontmatter, body),
        expectedMtimeMs: mtimeMs ?? undefined,
      });
      setMtimeMs(payload.file.mtimeMs);
      setHasUnsavedChanges(false);
      setHasConflict(false);
      setSaveState("saved");
      setSaveMessage("Markdown saved.");
      setFiles((previous) => previous.map((file) => (file.path === payload.file.path ? payload.file : file)));
    } catch (error) {
      setSaveState("error");
      setSaveMessage(error instanceof Error ? error.message : "Unable to save markdown file.");
      if (error instanceof WorkspaceApiRequestError && error.code === "STALE_FILE") {
        setHasConflict(true);
      }
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-4 px-4 py-6 sm:px-6">
        <Card className="bg-gradient-to-br from-background via-background to-secondary/20">
          <CardHeader>
            <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Context-Driven Development</p>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-3xl">CDD Workspace</CardTitle>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={toggleTheme}>
                  {theme === "dark" ? <Sun className="mr-1 size-4" /> : <Moon className="mr-1 size-4" />}
                  {theme === "dark" ? "Light" : "Dark"}
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/">Workspace Home</Link>
                </Button>
              </div>
            </div>
            <CardDescription>
              Browse context files in a collapsible file tree, view markdown in the center panel, and run selected next-action rows.
            </CardDescription>
          </CardHeader>
        </Card>

        <section className="grid gap-4 lg:grid-cols-[300px_1fr]">
          <Card className={cn("transition-all", sidebarCollapsed && "lg:w-16")}> 
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                {!sidebarCollapsed ? <CardTitle className="text-base">Context Tree</CardTitle> : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSidebarCollapsed((value) => !value)}
                >
                  {sidebarCollapsed ? "Expand" : "Collapse"}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {filesError ? <p className="text-sm text-destructive">{filesError}</p> : null}
              {!sidebarCollapsed ? (
                <div className="space-y-2">
                  {fileTree.map((projectNode) => (
                    <details key={projectNode.id} open className="rounded-lg border bg-muted/20 p-2">
                      <summary className="cursor-pointer text-sm font-semibold">{projectNode.label}</summary>
                      <div className="mt-2 space-y-2 pl-2">
                        {projectNode.children.map((featureNode) => (
                          <details key={featureNode.id} open>
                            <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              {featureNode.label}
                            </summary>
                            <ul className="mt-1 space-y-1 pl-2">
                              {featureNode.children.map((fileNode) => {
                                const active = contextFile === fileNode.path;
                                const fileMeta = files.find((file) => file.path === fileNode.path);
                                return (
                                  <li key={fileNode.id}>
                                    <button
                                      type="button"
                                      className={cn(
                                        "w-full rounded-md border px-2 py-1 text-left text-xs",
                                        active ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-muted",
                                      )}
                                    onClick={() => {
                                      if (fileNode.path) {
                                        updateQueryPath(fileNode.path);
                                        setContextFile(fileNode.path);
                                      }
                                    }}
                                  >
                                    {fileNode.label}
                                    {fileMeta?.readOnly ? (
                                      <span className="ml-1 text-[10px] text-amber-600">(read-only)</span>
                                    ) : null}
                                    {fileNode.path === contextFile && hasUnsavedChanges ? (
                                      <span className="ml-1 text-[10px] text-sky-600">(modified)</span>
                                    ) : null}
                                    {fileNode.path === contextFile && hasConflict ? (
                                      <span className="ml-1 text-[10px] text-destructive">(conflict)</span>
                                    ) : null}
                                  </button>
                                </li>
                              );
                              })}
                            </ul>
                          </details>
                        ))}
                      </div>
                    </details>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">File tree hidden</div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-lg">Context File Viewer</CardTitle>
                  <div className="flex items-center gap-2">
                    {selectedFileMeta?.readOnly ? <Badge variant="warning">read-only</Badge> : null}
                    {hasUnsavedChanges ? <Badge variant="secondary">modified</Badge> : null}
                    {hasConflict ? <Badge variant="destructive">conflict</Badge> : null}
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditorMode((value) => !value)}>
                      {editorMode ? "Preview" : "Edit"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!editorMode || !hasUnsavedChanges || selectedFileMeta?.readOnly}
                      onClick={() => {
                        void saveCurrentFile();
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
                <CardDescription>{contextFile || "Select a context file from the left tree."}</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingFile ? (
                  <p className="text-sm text-muted-foreground">Loading markdown...</p>
                ) : !contextFile ? (
                  <p className="text-sm text-muted-foreground">No context file selected.</p>
                ) : (
                  <div className="space-y-3">
                    {frontmatter ? (
                      <details className="rounded-md border bg-muted/30 p-2" open>
                        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          YAML Frontmatter
                        </summary>
                        {editorMode ? (
                          <textarea
                            className="mt-2 min-h-28 w-full rounded-md border bg-background p-2 font-mono text-xs"
                      value={frontmatter}
                      disabled={selectedFileMeta?.readOnly}
                      onChange={(event) => {
                        setFrontmatter(event.target.value);
                        setHasUnsavedChanges(true);
                        setHasConflict(false);
                        setSaveState("idle");
                      }}
                    />
                        ) : (
                          <pre className="mt-2 overflow-x-auto rounded-md border bg-background p-2 text-xs">{frontmatter}</pre>
                        )}
                      </details>
                    ) : null}

                    {editorMode ? (
                      <textarea
                        className="min-h-[360px] w-full rounded-md border bg-background p-3 font-mono text-sm"
                        value={body}
                        disabled={selectedFileMeta?.readOnly}
                        onChange={(event) => {
                          setBody(event.target.value);
                          setHasUnsavedChanges(true);
                          setHasConflict(false);
                          setSaveState("idle");
                        }}
                      />
                    ) : (
                      <article className="prose prose-neutral max-w-none rounded-md border bg-card p-4 text-sm dark:prose-invert">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{body || "No markdown content available."}</ReactMarkdown>
                      </article>
                    )}

                    {saveState !== "idle" ? (
                      <p className={cn("text-sm", saveState === "error" ? "text-destructive" : "text-muted-foreground")}>
                        {saveMessage}
                      </p>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>

            <section className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Row Execution</CardTitle>
                  <CardDescription>Select one Next Actions row and trigger backend execution.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <Label htmlFor="next-action-row">Next Action Row</Label>
                  <Select
                    ariaLabel="Next Action Row"
                    className="w-full"
                    value={selectedTestId}
                    options={rowOptions}
                    onValueChange={setSelectedTestId}
                  />

                  <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                    <p className="font-medium">Selected Row</p>
                    <p className="text-muted-foreground">{selectedRowDescription || "No row selected."}</p>
                  </div>

                  <Button
                    disabled={!selectedTestId || !contextId || busy}
                    onClick={() => {
                      if (!selectedTestId || !contextId || !contextFile) {
                        return;
                      }
                      setBusy(true);
                      void (async () => {
                        const result = await startRowExecution({
                          contextId,
                          contextFile,
                          testId: selectedTestId,
                        });
                        setActionMessage(result.message);
                        setBusy(false);
                      })();
                    }}
                  >
                    {busy ? "Starting..." : "Start Selected Row Execution"}
                  </Button>
                  {actionMessage ? <p className="text-sm text-muted-foreground">{actionMessage}</p> : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Task Status</CardTitle>
                  <CardDescription>Latest persisted row state from SQLite observability storage.</CardDescription>
                </CardHeader>
                <CardContent>
                  {!status || status.runId === null ? (
                    <div className="rounded-lg border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
                      No persisted row history yet. Run execution or use backfill to create SQLite records.
                    </div>
                  ) : (
                    <div className="grid gap-3 text-sm">
                      <p>
                        <span className="font-medium">Latest run:</span> #{status.runId}
                      </p>
                      <p>
                        <span className="font-medium">Started:</span> {displayTimestamp(status.timestamp)}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">Status:</span>
                        <Badge variant={statusVariant(status.status)}>{status.status}</Badge>
                      </div>
                      <p className="rounded-lg border bg-muted/30 p-3 text-muted-foreground">
                        {status.details || "No additional backend detail captured for this row."}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <Card>
              <CardHeader>
                <CardTitle>Live Session Stream</CardTitle>
                <CardDescription>Observe active run output for the selected row in near real time.</CardDescription>
              </CardHeader>
              <CardContent>
                {!liveStream ? (
                  <p className="text-sm text-muted-foreground">Loading stream state...</p>
                ) : (
                  <div className="grid gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="outline">provider: {liveStream.provider}</Badge>
                      <Badge variant="outline">session: {liveStream.sessionId}</Badge>
                      <Badge variant={liveStream.active ? "secondary" : "outline"}>
                        active: {liveStream.active ? "yes" : "no"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{liveStream.hint}</p>
                    <div className="max-h-80 overflow-auto rounded-lg border bg-muted/30 p-3">
                      {liveStream.events.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No stream events available for this row yet.</p>
                      ) : (
                        <ul className="space-y-2 text-sm">
                          {liveStream.events.map((event) => (
                            <li key={event.id} className="rounded-md border bg-card px-3 py-2">
                              <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{event.level}</p>
                              <p className={cn("mt-0.5", event.level === "error" && "text-destructive")}>{event.message}</p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
