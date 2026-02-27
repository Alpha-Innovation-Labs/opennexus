"use client";

import { useEffect, useMemo, useState } from "react";
import type { Edge, Node, NodeTypes } from "@xyflow/react";
import { Background, BackgroundVariant, Controls, MiniMap, ReactFlow, ReactFlowProvider, useNodesState } from "@xyflow/react";

import { ForkRootTranscriptNode } from "@/features/opencode-panel/components/nodes/fork-root-transcript-node";
import { ForkSessionNode } from "@/features/opencode-panel/components/nodes/fork-session-node";
import { useThemeMode } from "@/shared/hooks/use-theme-mode";

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
  createdAt?: number;
}

interface RootTranscriptLine {
  number: number;
  role: "user";
  text: string;
  highlighted: boolean;
  handleId?: string;
}

interface ForkRootTranscriptNodeData {
  title: string;
  lines: RootTranscriptLine[];
}

interface ForkSessionNodeData {
  title: string;
  shortId: string;
  isRoot: boolean;
  updatedLabel: string;
}

const forkNodeTypes: NodeTypes = {
  forkRootTranscript: ForkRootTranscriptNode,
  forkSession: ForkSessionNode,
};

function formatTimestamp(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return String(timestamp);
  }
}

function trimLine(text: string): string {
  const value = text.trim().replace(/\s+/g, " ");
  if (value.length <= 96) {
    return value;
  }
  return `${value.slice(0, 93)}...`;
}

function buildRootTranscriptLines(rootMessages: ConversationMessage[]): RootTranscriptLine[] {
  const filtered = rootMessages.filter((message) => message.role === "user" && message.content.trim().length > 0);
  return filtered.map((message, index) => ({
    number: index + 1,
    role: "user",
    text: trimLine(message.content),
    highlighted: false,
  }));
}

function normalizeForMatch(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function findForkLineIndex(rootMessages: ConversationMessage[], childCreatedAt: number, forkPrompt?: string): number {
  if (rootMessages.length === 0) {
    return -1;
  }

  const filtered = rootMessages.filter((message) => message.role === "user" && message.content.trim().length > 0);
  if (filtered.length === 0) {
    return -1;
  }

  const normalizedPrompt = typeof forkPrompt === "string" ? normalizeForMatch(forkPrompt) : "";
  if (normalizedPrompt.length > 0) {
    const promptMatches = filtered
      .map((message, index) => ({ message, index }))
      .filter((entry) => entry.message.role === "user" && normalizeForMatch(entry.message.content) === normalizedPrompt)
      .sort((a, b) => (b.message.createdAt ?? 0) - (a.message.createdAt ?? 0));

    if (promptMatches.length > 0) {
      return promptMatches[0].index;
    }
  }

  const userEntries = filtered.map((message, index) => ({ message, index }));

  const userWithTime = userEntries.filter((entry) => typeof entry.message.createdAt === "number" && Number.isFinite(entry.message.createdAt));
  if (userWithTime.length === 0 || !Number.isFinite(childCreatedAt)) {
    return userEntries[userEntries.length - 1]?.index ?? filtered.length - 1;
  }

  const prior = userWithTime
    .filter((entry) => (entry.message.createdAt as number) <= childCreatedAt)
    .sort((a, b) => (b.message.createdAt as number) - (a.message.createdAt as number));
  if (prior.length > 0) {
    return prior[0].index;
  }

  const nearest = userWithTime.sort(
    (a, b) => Math.abs((a.message.createdAt as number) - childCreatedAt) - Math.abs((b.message.createdAt as number) - childCreatedAt),
  );
  return nearest[0]?.index ?? userEntries[userEntries.length - 1]?.index ?? filtered.length - 1;
}

function buildForkLayout(
  conversations: ForkConversationSummary[],
  rootMessagesByRootId: Record<string, ConversationMessage[]>,
  forkPromptByChildId: Record<string, string>,
): { nodes: Node[]; edges: Edge[] } {
  const byId = new Map(conversations.map((item) => [item.id, item]));
  const childrenByParent = new Map<string, string[]>();

  for (const conversation of conversations) {
    if (!conversation.parentId || !byId.has(conversation.parentId)) {
      continue;
    }

    const existing = childrenByParent.get(conversation.parentId) ?? [];
    existing.push(conversation.id);
    childrenByParent.set(conversation.parentId, existing);
  }

  const rootIds = conversations
    .filter((conversation) => !conversation.parentId || !byId.has(conversation.parentId))
    .filter((conversation) => childrenByParent.has(conversation.id))
    .map((conversation) => conversation.id)
    .sort((left, right) => (byId.get(right)?.updatedAt ?? 0) - (byId.get(left)?.updatedAt ?? 0));

  // Temporary simplification: render only the most recently updated fork family.
  const visibleRootIds = rootIds.slice(0, 1);

  const ROOT_TRANSCRIPT_WIDTH = 620;
  const ROOT_X = 80;
  const ROOT_Y = 80;
  const FORK_X = 860;
  const FORK_Y = 80;
  const FORK_ROW_GAP = 120;

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  for (const rootId of visibleRootIds) {
    const root = byId.get(rootId);
    if (!root) {
      continue;
    }

    const childIds = (childrenByParent.get(rootId) ?? []).sort((left, right) => {
      const leftUpdated = byId.get(left)?.updatedAt ?? 0;
      const rightUpdated = byId.get(right)?.updatedAt ?? 0;
      return rightUpdated - leftUpdated;
    });

    const rootMessages = rootMessagesByRootId[rootId] ?? [];
    const rootLines = buildRootTranscriptLines(rootMessages);

    const handleByLineIndex = new Map<number, string>();
    const lineIndexByChildId = new Map<string, number>();

    for (const childId of childIds) {
      const child = byId.get(childId);
      if (!child) {
        continue;
      }

      const lineIndex = findForkLineIndex(rootMessages, child.createdAt, forkPromptByChildId[childId]);
      if (lineIndex < 0) {
        continue;
      }

      const handleId = `fork-line-${lineIndex + 1}`;
      handleByLineIndex.set(lineIndex, handleId);
      lineIndexByChildId.set(childId, lineIndex);
    }

    const transcriptLinesWithHighlight = rootLines.map((line, index) => ({
      ...line,
      highlighted: handleByLineIndex.has(index),
      handleId: handleByLineIndex.get(index),
    }));

    const transcriptHeight = Math.max(260, 44 + transcriptLinesWithHighlight.length * 28 + 18);

    const rootNodeId = `fork-root-transcript:${rootId}`;
    nodes.push({
      id: rootNodeId,
      type: "forkRootTranscript",
      draggable: true,
      selectable: true,
      data: {
        title: root.title,
        lines: transcriptLinesWithHighlight,
      } satisfies ForkRootTranscriptNodeData,
      position: {
        x: ROOT_X,
        y: ROOT_Y,
      },
      style: {
        width: ROOT_TRANSCRIPT_WIDTH,
        height: transcriptHeight,
      },
    });

    const positionedForks = childIds
      .map((childId) => {
        const child = byId.get(childId);
        if (!child) {
          return null;
        }

        const lineIndex = lineIndexByChildId.get(child.id) ?? Number.MAX_SAFE_INTEGER;
        return { child, lineIndex };
      })
      .filter((entry): entry is { child: ForkConversationSummary; lineIndex: number } => entry !== null)
      .sort((left, right) => {
        if (left.lineIndex !== right.lineIndex) {
          return left.lineIndex - right.lineIndex;
        }

        return right.child.updatedAt - left.child.updatedAt;
      });

    for (const [index, entry] of positionedForks.entries()) {
      const child = entry.child;

      nodes.push({
        id: child.id,
        type: "forkSession",
        draggable: true,
        selectable: true,
        data: {
          title: child.title,
          shortId: child.id.slice(0, 10),
          isRoot: false,
          updatedLabel: formatTimestamp(child.updatedAt),
        } satisfies ForkSessionNodeData,
        position: {
          x: FORK_X,
          y: FORK_Y + index * FORK_ROW_GAP,
        },
        style: {
          width: 300,
          height: 92,
        },
      });

      const lineIndex = lineIndexByChildId.get(child.id);
      const sourceHandle = typeof lineIndex === "number" ? `fork-line-${lineIndex + 1}` : undefined;

      edges.push({
        id: `${rootNodeId}->${child.id}`,
        source: rootNodeId,
        target: child.id,
        ...(sourceHandle ? { sourceHandle } : {}),
        targetHandle: "fork-in",
        type: "default",
        animated: false,
        style: {
          stroke: "var(--flow-edge)",
          strokeWidth: 1.6,
        },
      });
    }

    break;
  }

  return { nodes, edges };
}

function OpencodeForkGraphCanvasInner({ initialThemeMode }: { initialThemeMode: "light" | "dark" }) {
  const themeMode = initialThemeMode;
  const canvasBackground = themeMode === "dark" ? "#111315" : "#eef2f7";
  const gridDotColor = themeMode === "dark" ? "rgba(156, 163, 175, 0.46)" : "rgba(101, 123, 148, 0.5)";
  const [conversations, setConversations] = useState<ForkConversationSummary[]>([]);
  const [rootMessagesByRootId, setRootMessagesByRootId] = useState<Record<string, ConversationMessage[]>>({});
  const [forkPromptByChildId, setForkPromptByChildId] = useState<Record<string, string>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch("/api/opencode/conversations/forks", { method: "GET" });
        const payload = (await response.json().catch(() => ({}))) as {
          conversations?: ForkConversationSummary[];
          error?: { message?: string };
        };

        if (!response.ok || !Array.isArray(payload.conversations)) {
          throw new Error(payload.error?.message ?? "Failed to load forked conversations");
        }

        const nextConversations = payload.conversations;
        const byId = new Map(nextConversations.map((entry) => [entry.id, entry]));
        const childParentIds = new Set(nextConversations.map((entry) => entry.parentId).filter((id): id is string => Boolean(id)));
        const rootCandidates = nextConversations
          .filter((entry) => !entry.parentId || !byId.has(entry.parentId))
          .filter((entry) => childParentIds.has(entry.id))
          .sort((a, b) => b.updatedAt - a.updatedAt);

        const rootMessages: Record<string, ConversationMessage[]> = {};
        const nextForkPromptByChildId: Record<string, string> = {};
        const selectedRoot = rootCandidates[0];
        if (selectedRoot) {
          const messageResponse = await fetch(`/api/opencode/conversations/${selectedRoot.id}/messages?limit=300`, { method: "GET" });
          const body = (await messageResponse.json().catch(() => ({}))) as { messages?: ConversationMessage[] };
          rootMessages[selectedRoot.id] = Array.isArray(body.messages) ? body.messages : [];

          const directChildren = nextConversations.filter((entry) => entry.parentId === selectedRoot.id);
          await Promise.all(
            directChildren.map(async (child) => {
              const childResponse = await fetch(`/api/opencode/conversations/${child.id}/messages?limit=120`, { method: "GET" });
              const childBody = (await childResponse.json().catch(() => ({}))) as { messages?: ConversationMessage[] };
              const childMessages = Array.isArray(childBody.messages) ? childBody.messages : [];
              const firstUser = childMessages.find((message) => message.role === "user" && message.content.trim().length > 0);
              if (firstUser) {
                nextForkPromptByChildId[child.id] = firstUser.content;
              }
            }),
          );
        }

        if (!cancelled) {
          setConversations(nextConversations);
          setRootMessagesByRootId(rootMessages);
          setForkPromptByChildId(nextForkPromptByChildId);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load forked conversations");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const layout = useMemo(
    () => buildForkLayout(conversations, rootMessagesByRootId, forkPromptByChildId),
    [conversations, forkPromptByChildId, rootMessagesByRootId],
  );

  useEffect(() => {
    setNodes(layout.nodes);
  }, [layout.nodes, setNodes]);

  if (isLoading) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading fork graph...</div>;
  }

  if (errorMessage) {
    return <div className="flex h-full items-center justify-center px-6 text-center text-sm text-amber-300">{errorMessage}</div>;
  }

  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        No fork conversations found for this repository.
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden" data-testid="fork-graph-canvas">
      <ReactFlow
        nodes={nodes}
        edges={layout.edges}
        onNodesChange={onNodesChange}
        nodeTypes={forkNodeTypes}
        fitView
        fitViewOptions={{ padding: 0.16, minZoom: 0.24 }}
        minZoom={0.2}
        maxZoom={1.6}
        nodesDraggable
        panOnDrag
        nodesFocusable
        nodesConnectable={false}
        elementsSelectable
        colorMode={themeMode}
        style={{ backgroundColor: canvasBackground }}
      >
        <MiniMap position="bottom-right" pannable zoomable className="rounded-lg border border-border/70 bg-card/90" />
        <Controls position="bottom-right" className="!bottom-4 !right-[220px] rounded-lg border border-border/70 bg-card/90" />
        <Background variant={BackgroundVariant.Dots} gap={20} size={2} color={gridDotColor} />
      </ReactFlow>
    </div>
  );
}

export function OpencodeForkGraphCanvas() {
  const themeMode = useThemeMode();

  return (
    <ReactFlowProvider>
      <OpencodeForkGraphCanvasInner initialThemeMode={themeMode} />
    </ReactFlowProvider>
  );
}
