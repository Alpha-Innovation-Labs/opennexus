"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NodeMouseHandler, NodeTypes, OnMoveEnd, OnNodeDrag, OnNodesChange, Viewport } from "@xyflow/react";
import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { ChevronRight, FoldVertical, Move, MousePointer2, RefreshCw, Scaling } from "lucide-react";

import { ContextDetailsModal } from "@/features/context-graph/components/context-details-modal";
import { ContextCardNode } from "@/features/context-graph/components/nodes/context-card-node";
import { ProjectGroupNode } from "@/features/context-graph/components/nodes/project-group-node";
import { SubprojectTagNode } from "@/features/context-graph/components/nodes/subproject-tag-node";
import {
  createProjectDetailGraphData,
  createProjectOverviewLayout,
  createContextGraphLayout,
  type ContextFlowNode,
  type ContextFlowNodeData,
  type ProjectGroupNodeData,
  type SubprojectTagNodeData,
} from "@/features/context-graph/services/context-graph-layout-service";
import {
  hasSiblingCollision,
} from "@/features/context-graph/services/context-graph-collision-service";
import {
  closeContextDetails,
  createContextDetailsInitialState,
  openContextDetails,
} from "@/features/context-graph/model/context-details-state";
import type { ContextEdgeMapping } from "@/features/context-graph/model/context-graph-edges";
import type { ContextGraphData } from "@/features/context-graph/model/context-graph-types";
import type {
  NadPipelineStatus,
  NadStatusAdapterError,
  NadStatusResult,
} from "@/features/orchestration-status/model/nad-orchestration-status-types";
import { useThemeMode } from "@/shared/hooks/use-theme-mode";

interface ContextGraphCanvasProps {
  graphData: ContextGraphData;
  edgeMapping: ContextEdgeMapping;
  themeMode?: "light" | "dark";
}

const nodeTypes: NodeTypes = {
  projectGroup: ProjectGroupNode,
  contextCard: ContextCardNode,
  subprojectTag: SubprojectTagNode,
};

const FLOW_STORAGE_KEY = "cdd-react-flow-ui/state/v10";
const KEYBOARD_MOVE_STEP = 24;
const KEYBOARD_MOVE_STEP_FAST = 72;
const CONTEXT_NODE_WIDTH = 340;
const CONTEXT_NODE_HEIGHT = 108;
const COLLAPSED_GROUP_HEIGHT = 88;
const COLLISION_MARGIN = 8;

type InteractionMode = "select" | "move" | "resize";
type GraphViewState = { kind: "projects" } | { kind: "project-detail"; projectId: string };
type ContextStatusSummary = { status: string; runId: number | null; isError?: boolean };

function cycleInteractionMode(currentMode: InteractionMode): InteractionMode {
  if (currentMode === "select") {
    return "move";
  }

  if (currentMode === "move") {
    return "resize";
  }

  return "select";
}

function getDirectionalCandidate<T extends { x: number; y: number }>(
  current: T,
  candidates: Array<{ id: string; point: T }>,
  direction: "left" | "right" | "up" | "down",
): string | null {
  const filtered = candidates
    .filter(({ point }) => {
      if (direction === "left") return point.x < current.x;
      if (direction === "right") return point.x > current.x;
      if (direction === "up") return point.y < current.y;
      return point.y > current.y;
    })
    .map(({ id, point }) => ({
      id,
      distance: Math.hypot(point.x - current.x, point.y - current.y),
    }))
    .sort((a, b) => a.distance - b.distance);

  return filtered[0]?.id ?? null;
}

function normalizeStatusLabel(payload: NadPipelineStatus): string {
  if (payload.status === "running") {
    return "running";
  }
  if (payload.status === "success") {
    return "success";
  }
  if (payload.status === "failed") {
    return "failed";
  }
  if (payload.status === "stopped") {
    return "stopped";
  }
  if (payload.activeRunIds.length > 0) {
    return "active";
  }
  return payload.status || "idle";
}

interface PersistedFlowState {
  viewport: Viewport | null;
  nodeStateById: Record<string, { x: number; y: number; width?: number; height?: number }>;
}

function readPersistedFlowState(): PersistedFlowState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawState = window.localStorage.getItem(FLOW_STORAGE_KEY);
  if (!rawState) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawState) as PersistedFlowState;
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      viewport: parsed.viewport ?? null,
      nodeStateById: parsed.nodeStateById ?? {},
    };
  } catch {
    return null;
  }
}

function writePersistedFlowState(state: PersistedFlowState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(FLOW_STORAGE_KEY, JSON.stringify(state));
}

function ContextGraphCanvasInner({ graphData, edgeMapping, themeMode = "dark" }: ContextGraphCanvasProps) {
  const canvasBackground = themeMode === "dark" ? "#111315" : "#eef2f7";
  const gridDotColor = themeMode === "dark" ? "rgba(156, 163, 175, 0.46)" : "rgba(101, 123, 148, 0.5)";
  const [viewState, setViewState] = useState<GraphViewState>({ kind: "projects" });

  const detailGraphInput = useMemo(() => {
    if (viewState.kind !== "project-detail") {
      return null;
    }

    return createProjectDetailGraphData(graphData, edgeMapping.edges, viewState.projectId);
  }, [edgeMapping.edges, graphData, viewState]);

  const flowGraph = useMemo(() => {
    if (viewState.kind === "project-detail" && detailGraphInput) {
      return createContextGraphLayout(detailGraphInput.graphData, detailGraphInput.dependencyEdges);
    }

    return createProjectOverviewLayout(graphData, edgeMapping.edges);
  }, [detailGraphInput, edgeMapping.edges, graphData, viewState.kind]);
  const [nodes, setNodes] = useNodesState<ContextFlowNode>(flowGraph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowGraph.edges);
  const [detailsState, setDetailsState] = useState(createContextDetailsInitialState);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>("select");
  const [collapsedGroupIds, setCollapsedGroupIds] = useState<Set<string>>(new Set());
  const [statusByContextPath, setStatusByContextPath] = useState<Record<string, ContextStatusSummary>>({});
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const lastSafePositionByNodeIdRef = useRef<Record<string, { x: number; y: number }>>({});
  const dragStartPositionByNodeIdRef = useRef<Record<string, { x: number; y: number }>>({});
  const reactFlow = useReactFlow();
  const persistedState = useMemo(() => readPersistedFlowState(), []);
  const hasStoredViewport = Boolean(persistedState?.viewport);

  useEffect(() => {
    const nextSafePositions: Record<string, { x: number; y: number }> = {};
    for (const node of nodes) {
      nextSafePositions[node.id] = {
        x: node.position.x,
        y: node.position.y,
      };
    }

    lastSafePositionByNodeIdRef.current = nextSafePositions;
  }, [nodes]);

  useEffect(() => {
    let cancelled = false;

    const loadStatuses = async () => {
      const targets = graphData.contexts.filter((context) => !statusByContextPath[context.path]);
      if (targets.length === 0) {
        return;
      }

      const results = await Promise.all(
        targets.map(async (context) => {
          try {
            const response = await fetch(`/api/orchestration/status?contextFile=${encodeURIComponent(context.path)}`);
            const body = (await response.json()) as NadStatusResult | { error: NadStatusAdapterError };
            if (!response.ok || "error" in body) {
              return [
                context.path,
                {
                  status: "unavailable",
                  runId: null,
                  isError: true,
                },
              ] as const;
            }

            return [
              context.path,
              {
                status: normalizeStatusLabel(body.payload),
                runId: body.payload.runId,
              },
            ] as const;
          } catch {
            return [
              context.path,
              {
                status: "unavailable",
                runId: null,
                isError: true,
              },
            ] as const;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      setStatusByContextPath((current) => {
        const next = { ...current };
        for (const [contextPath, statusSummary] of results) {
          next[contextPath] = statusSummary;
        }
        return next;
      });
    };

    void loadStatuses();

    return () => {
      cancelled = true;
    };
  }, [graphData.contexts, statusByContextPath]);

  const persistState = useCallback(
    (targetNodes = nodes) => {
      const nodeStateById = Object.fromEntries(
        targetNodes
          .filter((node) => node.draggable !== false)
          .map((node) => {
          const width = typeof node.style?.width === "number" ? node.style.width : undefined;
          const height = typeof node.style?.height === "number" ? node.style.height : undefined;
          return [
            node.id,
            {
              x: node.position.x,
              y: node.position.y,
              width,
              height,
            },
          ];
          }),
      );
      writePersistedFlowState({
        viewport: reactFlow.getViewport(),
        nodeStateById,
      });
    },
    [nodes, reactFlow],
  );

  const handleResetGroup = useCallback(
    (groupId: string) => {
      setNodes((currentNodes) => {
        const groupNodeId =
          currentNodes.find((node) => {
            if (node.type !== "projectGroup") {
              return false;
            }

            const data = node.data as ProjectGroupNodeData;
            return data.groupId === groupId;
          })?.id ?? `project:${groupId}`;

        const nodesByParentId = new Map<string, string[]>();
        for (const node of currentNodes) {
          if (!node.parentId) {
            continue;
          }

          const existing = nodesByParentId.get(node.parentId) ?? [];
          existing.push(node.id);
          nodesByParentId.set(node.parentId, existing);
        }

        const descendants = new Set<string>([groupNodeId]);
        const queue = [groupNodeId];
        while (queue.length > 0) {
          const parentId = queue.shift();
          if (!parentId) {
            continue;
          }

          for (const childId of nodesByParentId.get(parentId) ?? []) {
            if (descendants.has(childId)) {
              continue;
            }

            descendants.add(childId);
            queue.push(childId);
          }
        }

        const defaultNodesById = flowGraph.defaultNodesById;
        const updatedNodes = currentNodes.map((node) => {
          if (!descendants.has(node.id)) {
            return node;
          }

          const defaultNode = defaultNodesById[node.id];
          if (!defaultNode) {
            return node;
          }

          if (node.id === groupNodeId) {
            const defaultWidth = typeof defaultNode.style?.width === "number" ? defaultNode.style.width : 380;
            const defaultHeight = typeof defaultNode.style?.height === "number" ? defaultNode.style.height : 620;

            return {
              ...node,
              position: node.position,
              style: {
                ...node.style,
                ...defaultNode.style,
                width: defaultWidth,
                height: defaultHeight,
              },
            };
          }

          return {
            ...node,
            position: defaultNode.position,
            style: {
              ...node.style,
              ...defaultNode.style,
            },
          };
        });

        persistState(updatedNodes);
        return updatedNodes;
      });
    },
    [flowGraph.defaultNodesById, persistState, setNodes],
  );

  const handleToggleCollapse = useCallback((groupId: string) => {
    setCollapsedGroupIds((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const allGroupIds = useMemo(
    () =>
      nodes
        .filter((node) => node.type === "projectGroup")
        .map((node) => (node.data as ProjectGroupNodeData).groupId),
    [nodes],
  );

  const areAllGroupsCollapsed = allGroupIds.length > 0 && allGroupIds.every((groupId) => collapsedGroupIds.has(groupId));

  const handleToggleAllSubflows = useCallback(() => {
    setCollapsedGroupIds((current) => {
      const shouldExpandAll = allGroupIds.every((groupId) => current.has(groupId));
      if (shouldExpandAll) {
        return new Set();
      }

      return new Set(allGroupIds);
    });
  }, [allGroupIds]);

  const handleNodesChange: OnNodesChange<ContextFlowNode> = useCallback(
    (changes) => {
      setNodes((currentNodes) => {
        const previousNodeById = new Map(currentNodes.map((node) => [node.id, node]));
        let nextNodes = applyNodeChanges(changes, currentNodes) as ContextFlowNode[];
        const movedNodeIds = new Set(changes.filter((change) => change.type === "position").map((change) => change.id));

        for (const movedNodeId of movedNodeIds) {
          const movedNode = nextNodes.find((node) => node.id === movedNodeId);
          if (!movedNode) {
            continue;
          }

          if (!hasSiblingCollision(movedNode, nextNodes, COLLISION_MARGIN)) {
            lastSafePositionByNodeIdRef.current[movedNode.id] = {
              x: movedNode.position.x,
              y: movedNode.position.y,
            };
            continue;
          }

          const previousNode = previousNodeById.get(movedNode.id);
          const safePosition =
            lastSafePositionByNodeIdRef.current[movedNode.id] ??
            dragStartPositionByNodeIdRef.current[movedNode.id] ??
            (previousNode
              ? {
                  x: previousNode.position.x,
                  y: previousNode.position.y,
                }
              : null);

          if (!safePosition) {
            continue;
          }

          nextNodes = nextNodes.map((node) =>
            node.id === movedNode.id
              ? {
                  ...node,
                  position: {
                    x: safePosition.x,
                    y: safePosition.y,
                  },
                }
              : node,
          );
        }

        return nextNodes;
      });
    },
    [setNodes],
  );

  const handleNodeDragStart: OnNodeDrag<ContextFlowNode> = useCallback((_, node) => {
    dragStartPositionByNodeIdRef.current[node.id] = {
      x: node.position.x,
      y: node.position.y,
    };
    lastSafePositionByNodeIdRef.current[node.id] = {
      x: node.position.x,
      y: node.position.y,
    };
  }, []);

  const handleRefreshAllFlows = useCallback(() => {
    setCollapsedGroupIds(new Set());
    setNodes((currentNodes) => {
      const defaultNodesById = flowGraph.defaultNodesById;
      const resetNodes = currentNodes.map((node) => {
        const defaultNode = defaultNodesById[node.id];
        if (!defaultNode) {
          return node;
        }

        return {
          ...node,
          position: defaultNode.position,
          style: defaultNode.style,
        };
      });

      persistState(resetNodes);
      return resetNodes;
    });
    setEdges(flowGraph.edges);
    canvasRef.current?.focus();
  }, [flowGraph.defaultNodesById, flowGraph.edges, persistState, setEdges, setNodes]);

  const nodesWithActions = useMemo(
    () => {
      const nodeById = new Map(nodes.map((node) => [node.id, node]));

      const isNodeHidden = (node: ContextFlowNode): boolean => {
        let parentId = node.parentId;
        while (parentId) {
          const parent = nodeById.get(parentId);
          if (!parent || parent.type !== "projectGroup") {
            parentId = parent?.parentId;
            continue;
          }

          const parentData = parent.data as ProjectGroupNodeData;
          if (collapsedGroupIds.has(parentData.groupId)) {
            return true;
          }

          parentId = parent.parentId;
        }

        return false;
      };

      return nodes.map((node) => {
        const hidden = isNodeHidden(node);

        if (node.type === "projectGroup") {
          const groupData = node.data as ProjectGroupNodeData;
          const collapsed = collapsedGroupIds.has(groupData.groupId);
          const showGroupControls = true;
          return {
            ...node,
            hidden,
            style: collapsed
              ? {
                  ...node.style,
                  height: COLLAPSED_GROUP_HEIGHT,
                }
              : node.style,
            data: {
              ...groupData,
              interactionMode,
              collapsed: showGroupControls ? collapsed : false,
              onResetGroup: showGroupControls ? handleResetGroup : undefined,
              onToggleCollapse: showGroupControls ? handleToggleCollapse : undefined,
            },
          };
        }

        if (node.type === "contextCard") {
          const contextData = node.data as ContextFlowNodeData;
          const orchestrationStatus = statusByContextPath[contextData.context.path];
          return {
            ...node,
            hidden,
            data: {
              ...contextData,
              interactionMode,
              orchestrationStatus,
            },
          };
        }

        return {
          ...node,
          hidden,
        };
      });
    },
    [
      collapsedGroupIds,
      handleResetGroup,
      handleToggleCollapse,
      interactionMode,
      nodes,
      statusByContextPath,
      viewState.kind,
    ],
  );

  const edgesWithVisibility = useMemo(() => {
    const visibleNodeIds = new Set(nodesWithActions.filter((node) => !node.hidden).map((node) => node.id));
    return edges.filter((edge) => visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target));
  }, [edges, nodesWithActions]);

  useEffect(() => {
    const persisted = persistedState;
    if (!persisted) {
      return;
    }

    const mergedNodes = flowGraph.nodes.map((node) => {
      if (node.draggable === false) {
        return node;
      }

      const persistedNodeState = persisted.nodeStateById[node.id];
      if (!persistedNodeState) {
        return node;
      }

      const clampedPosition = {
        x: persistedNodeState.x,
        y: persistedNodeState.y,
      };

      const defaultWidth = typeof node.style?.width === "number" ? node.style.width : undefined;
      const defaultHeight = typeof node.style?.height === "number" ? node.style.height : undefined;
      const isProjectGroup = node.type === "projectGroup";
      const mergedWidth =
        persistedNodeState.width !== undefined
          ? isProjectGroup && defaultWidth !== undefined
            ? Math.max(persistedNodeState.width, defaultWidth)
            : persistedNodeState.width
          : undefined;
      const mergedHeight =
        persistedNodeState.height !== undefined
          ? isProjectGroup && defaultHeight !== undefined
            ? Math.max(persistedNodeState.height, defaultHeight)
            : persistedNodeState.height
          : undefined;

      return {
        ...node,
        position: clampedPosition,
        style:
          mergedWidth !== undefined || mergedHeight !== undefined
            ? {
                ...node.style,
                ...(mergedWidth !== undefined ? { width: mergedWidth } : {}),
                ...(mergedHeight !== undefined ? { height: mergedHeight } : {}),
              }
            : node.style,
      };
    });

    setNodes(mergedNodes);

    if (persisted.viewport) {
      reactFlow.setViewport(persisted.viewport, { duration: 0 });
    }
  }, [flowGraph.nodes, persistedState, reactFlow, setNodes]);

  useEffect(() => {
    persistState(nodes);
  }, [nodes, persistState]);

  const handleMoveEnd: OnMoveEnd = useCallback(() => {
    persistState(nodes);
  }, [nodes, persistState]);

  const handleKeyboardMove = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === "Escape") {
        setInteractionMode("select");
        setFocusedNodeId(null);
        setDetailsState((current) => closeContextDetails(current));
        setNodes((currentNodes) =>
          currentNodes.map((node) => ({
            ...node,
            selected: false,
          })),
        );
        event.preventDefault();
        return;
      }

      if (event.key.toLowerCase() === "m") {
        setInteractionMode((current) => cycleInteractionMode(current));
        event.preventDefault();
        return;
      }

      if (event.key.toLowerCase() === "v") {
        setInteractionMode("select");
        event.preventDefault();
        return;
      }

      if (event.shiftKey && event.key.toLowerCase() === "r") {
        const focusedNode = focusedNodeId ? nodes.find((node) => node.id === focusedNodeId) : undefined;
        const focusedGroupId = focusedNode?.type === "projectGroup" ? focusedNode.id : focusedNode?.parentId;

        if (focusedGroupId) {
          const focusedGroup = nodes.find((node) => node.id === focusedGroupId && node.type === "projectGroup");
          if (focusedGroup) {
            const groupData = focusedGroup.data as ProjectGroupNodeData;
            handleResetGroup(groupData.groupId);
          }
        }

        event.preventDefault();
        return;
      }

      if (event.key.toLowerCase() === "r") {
        setInteractionMode("resize");
        event.preventDefault();
        return;
      }

      if (event.key === "Enter") {
        if (viewState.kind === "projects" && focusedNodeId) {
          const focusedProjectNode = nodes.find(
            (node) =>
              node.id === focusedNodeId &&
              node.type === "projectGroup" &&
              ((node.data as ProjectGroupNodeData).groupKind ?? "project") === "project",
          );
          if (focusedProjectNode) {
            const data = focusedProjectNode.data as ProjectGroupNodeData;
            const projectId = data.projectName ?? data.groupId;
            setViewState({ kind: "project-detail", projectId });
            setFocusedNodeId(null);
            event.preventDefault();
            return;
          }
        }

        if (interactionMode !== "select") {
          event.preventDefault();
          return;
        }

        if (focusedNodeId) {
          const selectedNode = nodes.find((node) => node.id === focusedNodeId && node.type === "contextCard");
          if (selectedNode) {
            const data = selectedNode.data as unknown as ContextFlowNodeData;
            setDetailsState((current) => openContextDetails(current, data.context));
          }
        }

        event.preventDefault();
        return;
      }

      const rawKey = event.key.length === 1 ? event.key.toLowerCase() : "";
      const isDirectionalVim = rawKey === "h" || rawKey === "j" || rawKey === "k" || rawKey === "l";
      if (isDirectionalVim) {
        const direction = rawKey === "h" ? "left" : rawKey === "l" ? "right" : rawKey === "k" ? "up" : "down";

        const allGroups = nodes.filter((node) => node.type === "projectGroup");
        const allContexts = nodes.filter((node) => node.type === "contextCard");

        const currentNode = focusedNodeId ? nodes.find((node) => node.id === focusedNodeId) : undefined;
        const currentPoint = currentNode
          ? {
              x: currentNode.position.x,
              y: currentNode.position.y,
            }
          : {
              x: 0,
              y: 0,
            };

        let nextNodeId: string | null = null;

        if (event.shiftKey) {
          const currentGroupId = currentNode?.type === "projectGroup" ? currentNode.id : currentNode?.parentId;
          const currentGroup = allGroups.find((group) => group.id === currentGroupId) ?? allGroups[0];

          if (currentGroup) {
            const nextGroupId = getDirectionalCandidate(
              { x: currentGroup.position.x, y: currentGroup.position.y },
              allGroups.filter((group) => group.id !== currentGroup.id).map((group) => ({
                id: group.id,
                point: { x: group.position.x, y: group.position.y },
              })),
              direction,
            );
            nextNodeId = nextGroupId;
          }
        } else {
          const currentGroupId = currentNode?.type === "projectGroup" ? currentNode.id : currentNode?.parentId;
          const inGroupContexts = allContexts.filter((node) => node.parentId === currentGroupId);
          const scope = inGroupContexts.length > 0 ? inGroupContexts : allContexts;

          nextNodeId = getDirectionalCandidate(
            currentPoint,
            scope.filter((node) => node.id !== currentNode?.id).map((node) => ({
              id: node.id,
              point: { x: node.position.x, y: node.position.y },
            })),
            direction,
          );
        }

        if (nextNodeId) {
          setFocusedNodeId(nextNodeId);
          setNodes((currentNodes) =>
            currentNodes.map((node) => ({
              ...node,
              selected: node.id === nextNodeId,
            })),
          );
        }

        event.preventDefault();
        return;
      }

      const key = event.key;
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(key)) {
        return;
      }

      if (interactionMode !== "move") {
        return;
      }

      const step = event.shiftKey ? KEYBOARD_MOVE_STEP_FAST : KEYBOARD_MOVE_STEP;
      const delta = {
        x: key === "ArrowLeft" ? -step : key === "ArrowRight" ? step : 0,
        y: key === "ArrowUp" ? -step : key === "ArrowDown" ? step : 0,
      };

      event.preventDefault();
      setNodes((currentNodes) => {
        const parentNodeById = new Map(currentNodes.map((node) => [node.id, node]));
        const selectedContextNodeIds = new Set(
          currentNodes.filter((node) => node.selected && node.type === "contextCard").map((node) => node.id),
        );

        const targetContextNodeIds =
          selectedContextNodeIds.size > 0
            ? selectedContextNodeIds
            : focusedNodeId
              ? new Set([focusedNodeId])
              : new Set<string>();

        const updatedNodes = currentNodes.map((node) => {
          if (!targetContextNodeIds.has(node.id)) {
            return node;
          }

          if (node.parentId && node.extent === "parent") {
            const parentNode = parentNodeById.get(node.parentId);
            const parentWidth = typeof parentNode?.style?.width === "number" ? parentNode.style.width : 380;
            const parentHeight = typeof parentNode?.style?.height === "number" ? parentNode.style.height : 620;
            const nodeWidth = typeof node.style?.width === "number" ? node.style.width : CONTEXT_NODE_WIDTH;
            const nodeHeight = typeof node.style?.height === "number" ? node.style.height : CONTEXT_NODE_HEIGHT;

            return {
              ...node,
              position: {
                x: Math.max(0, Math.min(node.position.x + delta.x, parentWidth - nodeWidth)),
                y: Math.max(0, Math.min(node.position.y + delta.y, parentHeight - nodeHeight)),
              },
            };
          }

          return {
            ...node,
            position: {
              x: node.position.x + delta.x,
              y: node.position.y + delta.y,
            },
          };
        });

        let nextNodes = updatedNodes;
        for (const targetNodeId of targetContextNodeIds) {
          const candidateNode = nextNodes.find((node) => node.id === targetNodeId);
          if (!candidateNode) {
            continue;
          }

          if (!hasSiblingCollision(candidateNode, nextNodes, COLLISION_MARGIN)) {
            continue;
          }

          const originalNode = currentNodes.find((node) => node.id === targetNodeId);
          if (!originalNode) {
            continue;
          }

          nextNodes = nextNodes.map((node) => (node.id === targetNodeId ? originalNode : node));
        }

        persistState(nextNodes);
        return nextNodes;
      });
    },
    [focusedNodeId, handleResetGroup, interactionMode, nodes, persistState, setNodes, viewState.kind],
  );

  if (graphData.contexts.length === 0) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background p-6 text-center">
        <div className="space-y-2">
          <p className="text-sm font-semibold">No context nodes found</p>
          <p className="text-sm text-muted-foreground">
            Expected markdown context files under `.nexus/context/**`. Verify your working directory or set `NEXUS_REPO_ROOT`.
          </p>
        </div>
      </div>
    );
  }

  const handleNodeClick: NodeMouseHandler = (_, node) => {
    if (node.type === "projectGroup" && viewState.kind === "projects") {
      setFocusedNodeId(node.id);
      canvasRef.current?.focus();
      return;
    }

    if (node.type !== "contextCard") {
      return;
    }

    setFocusedNodeId(node.id);
    canvasRef.current?.focus();
  };

  const handleNodeDoubleClick: NodeMouseHandler = (_, node) => {
    if (node.type === "projectGroup" && viewState.kind === "projects") {
      const data = node.data as ProjectGroupNodeData;
      const projectId = data.projectName ?? data.groupId;
      setViewState({ kind: "project-detail", projectId });
      setFocusedNodeId(null);
      setDetailsState((current) => closeContextDetails(current));
      canvasRef.current?.focus();
      return;
    }

    if (node.type !== "contextCard") {
      return;
    }

    setFocusedNodeId(node.id);
    const data = node.data as unknown as ContextFlowNodeData;
    setDetailsState((current) => openContextDetails(current, data.context));
    canvasRef.current?.focus();
  };

  const modeBadgeClassName =
    interactionMode === "move"
      ? "border-emerald-500/70 bg-emerald-500/10 text-emerald-300"
      : interactionMode === "resize"
        ? "border-amber-500/70 bg-amber-500/10 text-amber-300"
        : "border-border/70 bg-card/80 text-muted-foreground";

  const breadcrumbParts = useMemo(() => {
    const parts: string[] = ["Projects"];

    if (viewState.kind === "project-detail") {
      parts.push(viewState.projectId);

      const focusedNode = focusedNodeId ? nodes.find((node) => node.id === focusedNodeId) : undefined;
      if (focusedNode?.type === "subprojectTag") {
        const data = focusedNode.data as SubprojectTagNodeData;
        parts.push(data.label);
      }

      if (focusedNode?.type === "contextCard") {
        const data = focusedNode.data as ContextFlowNodeData;
        parts.push(data.context.id);
      }

      return parts;
    }

    const focusedNode = focusedNodeId ? nodes.find((node) => node.id === focusedNodeId) : undefined;
    if (focusedNode?.type === "projectGroup") {
      const data = focusedNode.data as ProjectGroupNodeData;
      if ((data.groupKind ?? "project") === "project") {
        parts.push(data.projectName ?? data.groupId);
      }
    }

    return parts;
  }, [focusedNodeId, nodes, viewState]);

  return (
    <>
      <div
        ref={canvasRef}
        data-testid="context-graph-canvas"
        className="h-full w-full overflow-hidden"
        style={{ backgroundColor: canvasBackground }}
        tabIndex={0}
        onKeyDown={handleKeyboardMove}
      >
        <ReactFlow
          nodes={nodesWithActions}
          edges={edgesWithVisibility}
          nodeTypes={nodeTypes}
          colorMode={themeMode}
          snapToGrid
          snapGrid={[24, 24]}
          fitView={!hasStoredViewport}
          fitViewOptions={{ padding: 0.12, minZoom: 0.28 }}
          onNodeClick={handleNodeClick}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeDragStart={handleNodeDragStart}
          onMoveEnd={handleMoveEnd}
          minZoom={0.2}
          maxZoom={1.8}
          nodesDraggable={interactionMode === "move"}
          nodesFocusable
          nodesConnectable={false}
          elementsSelectable
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          style={{ backgroundColor: canvasBackground }}
        >
          <Panel position="top-left" className="!left-4 !top-4">
            <div className="inline-flex items-center gap-1.5 rounded-md border border-border/70 bg-card/90 px-2.5 py-1 text-[11px] text-muted-foreground">
              {breadcrumbParts.map((part, index) => (
                <span key={`${part}-${index}`} className="inline-flex items-center gap-1.5">
                  {index > 0 ? <ChevronRight className="h-3 w-3" /> : null}
                  <span className={index === breadcrumbParts.length - 1 ? "max-w-[220px] truncate text-foreground" : undefined} title={part}>
                    {part}
                  </span>
                </span>
              ))}
            </div>
          </Panel>
          <MiniMap position="bottom-right" pannable zoomable className="rounded-lg border border-border/70 bg-card/90" />
          <Controls position="bottom-right" className="!bottom-4 !right-[220px] rounded-lg border border-border/70 bg-card/90" />
          <Panel position="bottom-right" className="!bottom-4 !right-[380px]">
            <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/90 p-2 text-xs">
              {viewState.kind === "project-detail" ? (
                <button
                  type="button"
                  onClick={() => {
                    setViewState({ kind: "projects" });
                    setFocusedNodeId(null);
                    setDetailsState((current) => closeContextDetails(current));
                    canvasRef.current?.focus();
                  }}
                  className="inline-flex items-center gap-1.5 rounded border border-border/70 px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  Projects view
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  handleToggleAllSubflows();
                  canvasRef.current?.focus();
                }}
                className="inline-flex items-center gap-1.5 rounded border border-border/70 px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <FoldVertical className="h-3.5 w-3.5" />
                {areAllGroupsCollapsed ? "Expand all" : "Collapse all"}
              </button>
              <button
                type="button"
                onClick={handleRefreshAllFlows}
                className="inline-flex items-center gap-1.5 rounded border border-border/70 px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh flows
              </button>
              <button
                type="button"
                onClick={() => {
                  setInteractionMode("select");
                  canvasRef.current?.focus();
                }}
                className="inline-flex items-center gap-1.5 rounded border border-border/70 px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <MousePointer2 className="h-3.5 w-3.5" />
                Select
                <span className="rounded border border-border/60 px-1 py-0.5 text-[10px] uppercase">V</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setInteractionMode("move");
                  canvasRef.current?.focus();
                }}
                className="inline-flex items-center gap-1.5 rounded border border-border/70 px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Move className="h-3.5 w-3.5" />
                Move
                <span className="rounded border border-border/60 px-1 py-0.5 text-[10px] uppercase">M</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setInteractionMode("resize");
                  canvasRef.current?.focus();
                }}
                className="inline-flex items-center gap-1.5 rounded border border-border/70 px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Scaling className="h-3.5 w-3.5" />
                Resize
                <span className="rounded border border-border/60 px-1 py-0.5 text-[10px] uppercase">R</span>
              </button>
              <span className={`rounded border px-2 py-1 font-medium uppercase tracking-[0.08em] ${modeBadgeClassName}`}>
                {interactionMode}
              </span>
            </div>
          </Panel>
          <Background variant={BackgroundVariant.Dots} gap={20} size={2} color={gridDotColor} />
        </ReactFlow>
      </div>

      <ContextDetailsModal
        context={detailsState.selectedContext}
        open={detailsState.isOpen}
        onOpenChange={(open) => {
          if (open) {
            return;
          }

          setDetailsState((current) => closeContextDetails(current));
        }}
      />
    </>
  );
}

export function ContextGraphCanvas(props: ContextGraphCanvasProps) {
  const inferredThemeMode = useThemeMode();
  const resolvedThemeMode = props.themeMode ?? inferredThemeMode;

  return (
    <ReactFlowProvider>
      <ContextGraphCanvasInner {...props} themeMode={resolvedThemeMode} />
    </ReactFlowProvider>
  );
}
