import dagre from "dagre";
import { MarkerType, Position, type Edge, type Node } from "@xyflow/react";

import type { ContextDependencyEdge } from "@/features/context-graph/model/context-graph-edges";
import type { ContextGraphData, ContextNodeEntity } from "@/features/context-graph/model/context-graph-types";

export interface ProjectGroupNodeData extends Record<string, unknown> {
  groupId: string;
  groupKind?: "project" | "feature";
  projectName?: string;
  label: string;
  requiredWidth?: number;
  requiredHeight?: number;
  interactionMode?: "select" | "move" | "resize";
  onResetGroup?: (groupId: string) => void;
  onToggleCollapse?: (groupId: string) => void;
  collapsed?: boolean;
}

export interface ContextFlowNodeData extends Record<string, unknown> {
  title: string;
  titleLineCount: 1 | 2;
  interactionMode?: "select" | "move" | "resize";
  orchestrationStatus?: {
    status: string;
    runId: number | null;
    isError?: boolean;
  };
  context: ContextNodeEntity;
}

export interface SubprojectTagNodeData extends Record<string, unknown> {
  label: string;
  shortTag: string;
  contextCount: number;
  adapterContextCount: number;
  projectId: string;
}

export type ContextFlowNode = Node<ProjectGroupNodeData | ContextFlowNodeData | SubprojectTagNodeData>;

export interface ContextFlowLayout {
  nodes: ContextFlowNode[];
  edges: Edge[];
  defaultNodesById: Record<string, ContextFlowNode>;
}

const GROUP_MIN_WIDTH = 380;
const GROUP_GAP_X = 80;
const GROUP_HEADER_HEIGHT = 62;
const GROUP_PADDING_X = 20;
const GROUP_PADDING_RIGHT = 20;
const GROUP_PADDING_BOTTOM = 24;
const GROUP_MIN_HEIGHT = 620;
const FEATURE_GROUP_GAP_Y = 24;
const PROJECT_GROUP_PADDING_TOP = 16;
const PROJECT_GROUP_PADDING_BOTTOM = 20;
const PROJECT_OVERVIEW_SHELL_WIDTH = 380;
const PROJECT_OVERVIEW_SHELL_MIN_HEIGHT = 120;
const PROJECT_OVERVIEW_ITEM_HEIGHT = 72;
const PROJECT_OVERVIEW_ITEM_GAP = 12;
const PROJECT_OVERVIEW_INNER_PADDING_TOP = 16;
const PROJECT_OVERVIEW_INNER_PADDING_BOTTOM = 24;

function toThreeLetterTag(label: string): string {
  const compact = label.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  if (compact.length >= 3) {
    return compact.slice(0, 3);
  }

  if (compact.length > 0) {
    return compact.padEnd(3, "X");
  }

  return "N/A";
}

function pickEdgeColor(edgeId: string): string {
  void edgeId;
  return "var(--color-edge-blue)";
}

const CARD_MAX_WIDTH = 250;
const CARD_ONE_LINE_HEIGHT = 65;
const CARD_TWO_LINE_HEIGHT = 75;

interface ContextCardSize {
  width: number;
  height: number;
  titleLineCount: 1 | 2;
}

function inferTitleLineCount(title: string): 1 | 2 {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return 1;
  }

  const maxCharsPerLine = 26;
  let lineLength = 0;
  let lineCount: 1 | 2 = 1;

  for (const word of words) {
    const nextLength = lineLength === 0 ? word.length : lineLength + 1 + word.length;
    if (nextLength <= maxCharsPerLine) {
      lineLength = nextLength;
      continue;
    }

    if (lineCount === 2) {
      return 2;
    }

    lineCount = 2;
    lineLength = word.length;
  }

  return lineCount;
}

function getContextCardSize(context: ContextNodeEntity): ContextCardSize {
  const titleLineCount = inferTitleLineCount(context.title);

  return {
    width: CARD_MAX_WIDTH,
    height: titleLineCount === 1 ? CARD_ONE_LINE_HEIGHT : CARD_TWO_LINE_HEIGHT,
    titleLineCount,
  };
}

function layoutContextsWithinGroup(contexts: ContextNodeEntity[], dependencyEdges: ContextDependencyEdge[]): Record<string, { x: number; y: number }> {
  const graph = new dagre.graphlib.Graph();
  graph.setGraph({
    rankdir: "TB",
    nodesep: 32,
    ranksep: 56,
    marginx: 0,
    marginy: 0,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  const cardSizeByContextId = new Map<string, ContextCardSize>();
  for (const context of contexts) {
    const cardSize = getContextCardSize(context);
    cardSizeByContextId.set(context.id, cardSize);
    graph.setNode(context.id, { width: cardSize.width, height: cardSize.height });
  }

  const localIds = new Set(contexts.map((context) => context.id));
  const layoutEdgeKeys = new Set<string>();
  for (const edge of dependencyEdges) {
    if (localIds.has(edge.sourceContextId) && localIds.has(edge.targetContextId)) {
      graph.setEdge(edge.sourceContextId, edge.targetContextId);
      layoutEdgeKeys.add(`${edge.sourceContextId}->${edge.targetContextId}`);
    }
  }

  if (layoutEdgeKeys.size === 0) {
    for (let index = 1; index < contexts.length; index += 1) {
      const previousId = contexts[index - 1]?.id;
      const currentId = contexts[index]?.id;
      if (!previousId || !currentId) {
        continue;
      }

      const key = `${previousId}->${currentId}`;
      if (!layoutEdgeKeys.has(key)) {
        graph.setEdge(previousId, currentId, { weight: 0.01 });
        layoutEdgeKeys.add(key);
      }
    }
  }

  dagre.layout(graph);

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const context of contexts) {
    const nodeWithPosition = graph.node(context.id);
    if (!nodeWithPosition) {
      continue;
    }

    const cardSize = cardSizeByContextId.get(context.id) ?? getContextCardSize(context);
    minX = Math.min(minX, nodeWithPosition.x - cardSize.width / 2);
    minY = Math.min(minY, nodeWithPosition.y - cardSize.height / 2);
  }

  if (!Number.isFinite(minX)) {
    minX = 0;
  }

  if (!Number.isFinite(minY)) {
    minY = 0;
  }

  const positioned: Record<string, { x: number; y: number }> = {};
  for (const context of contexts) {
    const nodeWithPosition = graph.node(context.id);
    if (!nodeWithPosition) {
      continue;
    }

    positioned[context.id] = {
      x: Math.max(0, Math.round(nodeWithPosition.x - (cardSizeByContextId.get(context.id)?.width ?? CARD_MAX_WIDTH) / 2 - minX)),
      y: Math.max(0, Math.round(nodeWithPosition.y - (cardSizeByContextId.get(context.id)?.height ?? CARD_TWO_LINE_HEIGHT) / 2 - minY)),
    };
  }

  return positioned;
}

export function createProjectOverviewLayout(data: ContextGraphData, dependencyEdges: ContextDependencyEdge[]): ContextFlowLayout {
  const nodes: ContextFlowNode[] = [];
  const edges: Edge[] = [];
  const defaultNodesById: Record<string, ContextFlowNode> = {};

  const contextsByProject = new Map<string, ContextNodeEntity[]>();
  for (const context of data.contexts) {
    const existing = contextsByProject.get(context.project) ?? [];
    existing.push(context);
    contextsByProject.set(context.project, existing);
  }

  const projectByContextId = new Map(data.contexts.map((context) => [context.id, context.project]));
  const orderedProjects = Array.from(contextsByProject.keys()).sort((left, right) => left.localeCompare(right));

  const shellSizeByProject = new Map<string, { width: number; height: number }>();
  const subprojectsByProject = new Map<string, Array<[string, ContextNodeEntity[]]>>();

  for (const projectId of orderedProjects) {
    const shellWidth = PROJECT_OVERVIEW_SHELL_WIDTH;
    const contextsInProject = contextsByProject.get(projectId) ?? [];
    const contextsBySubproject = new Map<string, ContextNodeEntity[]>();
    for (const context of contextsInProject) {
      const subprojectId = context.feature || projectId;
      const existing = contextsBySubproject.get(subprojectId) ?? [];
      existing.push(context);
      contextsBySubproject.set(subprojectId, existing);
    }

    const orderedSubprojects = Array.from(contextsBySubproject.entries()).sort(([left], [right]) => left.localeCompare(right));
    const itemCount = orderedSubprojects.length;
    const shellHeight = Math.max(
      PROJECT_OVERVIEW_SHELL_MIN_HEIGHT,
      GROUP_HEADER_HEIGHT +
        PROJECT_OVERVIEW_INNER_PADDING_TOP +
        itemCount * PROJECT_OVERVIEW_ITEM_HEIGHT +
        Math.max(0, itemCount - 1) * PROJECT_OVERVIEW_ITEM_GAP +
        PROJECT_OVERVIEW_INNER_PADDING_BOTTOM,
    );

    shellSizeByProject.set(projectId, { width: shellWidth, height: shellHeight });
    subprojectsByProject.set(projectId, orderedSubprojects);
  }

  const projectLayoutGraph = new dagre.graphlib.Graph();
  projectLayoutGraph.setGraph({
    rankdir: "TB",
    nodesep: 56,
    ranksep: 72,
    marginx: 0,
    marginy: 0,
  });
  projectLayoutGraph.setDefaultEdgeLabel(() => ({}));

  for (const projectId of orderedProjects) {
    const projectShellId = `project-shell:${projectId}`;
    const shellSize = shellSizeByProject.get(projectId) ?? { width: PROJECT_OVERVIEW_SHELL_WIDTH, height: PROJECT_OVERVIEW_SHELL_MIN_HEIGHT };
    projectLayoutGraph.setNode(projectShellId, {
      width: shellSize.width,
      height: shellSize.height,
    });
  }

  const projectDependencyKeySet = new Set<string>();
  for (const dependencyEdge of dependencyEdges) {
    const prerequisiteProject = projectByContextId.get(dependencyEdge.sourceContextId);
    const dependentProject = projectByContextId.get(dependencyEdge.targetContextId);
    if (!dependentProject || !prerequisiteProject || dependentProject === prerequisiteProject) {
      continue;
    }

    const edgeKey = `${prerequisiteProject}->${dependentProject}`;
    if (projectDependencyKeySet.has(edgeKey)) {
      continue;
    }

    projectDependencyKeySet.add(edgeKey);
    projectLayoutGraph.setEdge(`project-shell:${prerequisiteProject}`, `project-shell:${dependentProject}`, {
      weight: 1,
      minlen: 1,
    });
  }

  dagre.layout(projectLayoutGraph);

  let minProjectX = Number.POSITIVE_INFINITY;
  let minProjectY = Number.POSITIVE_INFINITY;
  const projectPositionById = new Map<string, { x: number; y: number }>();
  const rowTopByCenterY = new Map<string, number>();
  const centerYByProject = new Map<string, string>();

  for (const projectId of orderedProjects) {
    const shellId = `project-shell:${projectId}`;
    const laidOut = projectLayoutGraph.node(shellId);
    const shellSize = shellSizeByProject.get(projectId) ?? { width: PROJECT_OVERVIEW_SHELL_WIDTH, height: PROJECT_OVERVIEW_SHELL_MIN_HEIGHT };
    if (!laidOut) {
      continue;
    }

    const topLeftX = Math.round(laidOut.x - shellSize.width / 2);
    const topLeftY = Math.round(laidOut.y - shellSize.height / 2);
    const centerYKey = laidOut.y.toFixed(3);

    const existingRowTop = rowTopByCenterY.get(centerYKey);
    if (existingRowTop === undefined || topLeftY < existingRowTop) {
      rowTopByCenterY.set(centerYKey, topLeftY);
    }
    centerYByProject.set(projectId, centerYKey);

    minProjectX = Math.min(minProjectX, topLeftX);
    minProjectY = Math.min(minProjectY, topLeftY);
    projectPositionById.set(projectId, { x: topLeftX, y: topLeftY });
  }

  for (const [projectId, position] of projectPositionById.entries()) {
    const centerYKey = centerYByProject.get(projectId);
    if (!centerYKey) {
      continue;
    }

    const alignedRowTop = rowTopByCenterY.get(centerYKey);
    if (alignedRowTop === undefined) {
      continue;
    }

    projectPositionById.set(projectId, {
      x: position.x,
      y: alignedRowTop,
    });
    minProjectY = Math.min(minProjectY, alignedRowTop);
  }

  if (!Number.isFinite(minProjectX)) {
    minProjectX = 0;
  }
  if (!Number.isFinite(minProjectY)) {
    minProjectY = 0;
  }

  for (const projectId of orderedProjects) {
    const projectShellId = `project-shell:${projectId}`;
    const shellSize = shellSizeByProject.get(projectId) ?? { width: PROJECT_OVERVIEW_SHELL_WIDTH, height: PROJECT_OVERVIEW_SHELL_MIN_HEIGHT };
    const rawPosition = projectPositionById.get(projectId) ?? { x: 0, y: 0 };
    const shellPosition = {
      x: Math.max(0, rawPosition.x - minProjectX),
      y: Math.max(0, rawPosition.y - minProjectY),
    };

    const projectShellNode: ContextFlowNode = {
      id: projectShellId,
      type: "projectGroup",
      position: shellPosition,
      style: { width: shellSize.width, height: shellSize.height },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
      draggable: true,
      selectable: true,
        data: {
          groupId: projectId,
          groupKind: "project",
          projectName: projectId,
          label: projectId,
          requiredWidth: shellSize.width,
          requiredHeight: shellSize.height,
        },
      };
    nodes.push(projectShellNode);
    defaultNodesById[projectShellNode.id] = { ...projectShellNode, data: { ...projectShellNode.data } };

    const orderedSubprojects = subprojectsByProject.get(projectId) ?? [];
    orderedSubprojects.forEach(([subprojectId, subprojectContexts], subprojectIndex) => {
      const featureTitle = subprojectContexts[0]?.featureTitle ?? subprojectId;
      const nodeId = `subproject:${projectId}/${subprojectId}`;
      const subprojectNode: ContextFlowNode = {
        id: nodeId,
        type: "subprojectTag",
        parentId: projectShellId,
        extent: "parent",
        position: {
          x: GROUP_PADDING_X,
          y: GROUP_HEADER_HEIGHT + PROJECT_OVERVIEW_INNER_PADDING_TOP + subprojectIndex * (PROJECT_OVERVIEW_ITEM_HEIGHT + PROJECT_OVERVIEW_ITEM_GAP),
        },
        style: {
          width: shellSize.width - GROUP_PADDING_X - GROUP_PADDING_RIGHT,
          height: PROJECT_OVERVIEW_ITEM_HEIGHT,
        },
        draggable: false,
        selectable: false,
        data: {
          label: featureTitle,
          shortTag: toThreeLetterTag(subprojectId),
          contextCount: subprojectContexts.length,
          adapterContextCount: subprojectContexts.filter((context) => context.isAdapterAuthored).length,
          projectId,
        },
      };

      nodes.push(subprojectNode);
      defaultNodesById[subprojectNode.id] = { ...subprojectNode, data: { ...subprojectNode.data } };
    });
  }

  const projectEdgeSet = new Set<string>();
  for (const dependencyEdge of dependencyEdges) {
    const prerequisiteProject = projectByContextId.get(dependencyEdge.sourceContextId);
    const dependentProject = projectByContextId.get(dependencyEdge.targetContextId);
    if (!dependentProject || !prerequisiteProject || dependentProject === prerequisiteProject) {
      continue;
    }

    const edgeId = `project-dep:${prerequisiteProject}->${dependentProject}`;
    if (projectEdgeSet.has(edgeId)) {
      continue;
    }

    projectEdgeSet.add(edgeId);
    const edgeColor = pickEdgeColor(edgeId);
    edges.push({
      id: edgeId,
      source: `project-shell:${prerequisiteProject}`,
      target: `project-shell:${dependentProject}`,
      sourceHandle: "project-out",
      targetHandle: "project-in",
      type: "smoothstep",
      style: {
        strokeDasharray: "12 8",
        strokeWidth: 2.4,
        stroke: edgeColor,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edgeColor,
      },
    });
  }

  return { nodes, edges, defaultNodesById };
}

export function createProjectDetailGraphData(
  graphData: ContextGraphData,
  dependencyEdges: ContextDependencyEdge[],
  selectedProjectId: string,
): { graphData: ContextGraphData; dependencyEdges: ContextDependencyEdge[] } {
  const contextsById = new Map(graphData.contexts.map((context) => [context.id, context]));
  const selectedContexts = graphData.contexts.filter((context) => context.project === selectedProjectId);
  const selectedContextIds = new Set(selectedContexts.map((context) => context.id));

  const includedContextIds = new Set(selectedContextIds);
  for (const edge of dependencyEdges) {
    if (!selectedContextIds.has(edge.targetContextId)) {
      continue;
    }

    const sourceContext = contextsById.get(edge.sourceContextId);
    if (!sourceContext) {
      continue;
    }

    if (sourceContext.project !== selectedProjectId) {
      includedContextIds.add(sourceContext.id);
    }
  }

  const filteredContexts = graphData.contexts.filter((context) => includedContextIds.has(context.id));
  const filteredContextIds = new Set(filteredContexts.map((context) => context.id));
  const filteredEdges = dependencyEdges.filter((edge) => {
    if (!filteredContextIds.has(edge.sourceContextId) || !filteredContextIds.has(edge.targetContextId)) {
      return false;
    }

    const targetContext = contextsById.get(edge.targetContextId);
    return targetContext?.project === selectedProjectId;
  });

  const projects = Array.from(new Set(filteredContexts.map((context) => context.project)))
    .sort((left, right) => left.localeCompare(right))
    .map((project) => ({ id: project, label: project }));

  return {
    graphData: {
      projects,
      contexts: filteredContexts,
      unresolvedDependencies: graphData.unresolvedDependencies.filter(
        (item) => filteredContextIds.has(item.contextId) || filteredContextIds.has(item.dependencyId),
      ),
    },
    dependencyEdges: filteredEdges,
  };
}

export function createContextGraphLayout(data: ContextGraphData, dependencyEdges: ContextDependencyEdge[]): ContextFlowLayout {
  const nodes: ContextFlowNode[] = [];
  const edges: Edge[] = [];
  const defaultNodesById: Record<string, ContextFlowNode> = {};

  const contextsByGroup = new Map<string, ContextNodeEntity[]>();
  for (const context of data.contexts) {
    const groupId = `${context.project}/${context.feature}`;
    const existing = contextsByGroup.get(groupId) ?? [];
    existing.push(context);
    contextsByGroup.set(groupId, existing);
  }

  const groupIdsByProject = new Map<string, string[]>();
  for (const groupId of contextsByGroup.keys()) {
    const [project] = groupId.split("/");
    const existing = groupIdsByProject.get(project ?? "unknown-project") ?? [];
    existing.push(groupId);
    groupIdsByProject.set(project ?? "unknown-project", existing);
  }

  const orderedProjects = Array.from(groupIdsByProject.keys()).sort((left, right) => left.localeCompare(right));
  const flowNodeIdByContextId = new Map<string, string>();
  let currentGroupX = 0;

  for (const project of orderedProjects) {
    const featureGroupIds = (groupIdsByProject.get(project) ?? []).sort((left, right) => left.localeCompare(right));
    const projectNodeId = `project:${project}`;
    const pendingFeatureNodes: ContextFlowNode[] = [];
    const pendingContextNodes: ContextFlowNode[] = [];
    let projectContentWidth = 0;
    let projectContentHeight = PROJECT_GROUP_PADDING_TOP;

    for (const groupId of featureGroupIds) {
      const contexts = (contextsByGroup.get(groupId) ?? []).sort((left, right) => left.id.localeCompare(right.id));
      const positionedContexts = layoutContextsWithinGroup(contexts, dependencyEdges);

      let contentBottom = 0;
      let contentRight = 0;
      for (const context of contexts) {
        const pos = positionedContexts[context.id] ?? { x: 0, y: 0 };
        const cardSize = getContextCardSize(context);
        contentBottom = Math.max(contentBottom, pos.y + cardSize.height);
        contentRight = Math.max(contentRight, pos.x + cardSize.width);
      }

      const featureHeight = Math.max(GROUP_MIN_HEIGHT, GROUP_HEADER_HEIGHT + contentBottom + GROUP_PADDING_BOTTOM);
      const featureWidth = Math.max(GROUP_MIN_WIDTH, GROUP_PADDING_X + contentRight + GROUP_PADDING_RIGHT);
      const featureNodeId = `feature:${groupId}`;

      const featureNode: ContextFlowNode = {
        id: featureNodeId,
        type: "projectGroup",
        parentId: projectNodeId,
        extent: "parent",
        expandParent: true,
        draggable: true,
        selectable: true,
        position: {
          x: GROUP_PADDING_X,
          y: projectContentHeight,
        },
        style: {
          width: featureWidth,
          height: featureHeight,
        },
        data: {
          groupId,
          groupKind: "feature",
          projectName: project,
          label: groupId.split("/").slice(1).join("/") || project,
          requiredWidth: featureWidth,
          requiredHeight: featureHeight,
        },
      };

      pendingFeatureNodes.push(featureNode);
      defaultNodesById[featureNode.id] = { ...featureNode, data: { ...featureNode.data } };

      projectContentHeight += featureHeight + FEATURE_GROUP_GAP_Y;
      projectContentWidth = Math.max(projectContentWidth, featureWidth);

      for (const context of contexts) {
        const contextNodeId = `context:${context.id}`;
        flowNodeIdByContextId.set(context.id, contextNodeId);

        const pos = positionedContexts[context.id] ?? { x: 0, y: 0 };
        const cardSize = getContextCardSize(context);
        const contextNode: ContextFlowNode = {
          id: contextNodeId,
          type: "contextCard",
          parentId: featureNodeId,
          extent: "parent",
          expandParent: true,
          dragHandle: ".context-drag-handle",
          position: {
            x: GROUP_PADDING_X + pos.x,
            y: GROUP_HEADER_HEIGHT + pos.y,
          },
          style: {
            width: cardSize.width,
            height: cardSize.height,
          },
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
          draggable: true,
          data: {
            title: context.title,
            titleLineCount: cardSize.titleLineCount,
            context,
          },
        };

        pendingContextNodes.push(contextNode);
        defaultNodesById[contextNode.id] = { ...contextNode, data: { ...contextNode.data } };
      }
    }

    const projectWidth = Math.max(GROUP_MIN_WIDTH + GROUP_PADDING_X + GROUP_PADDING_RIGHT, projectContentWidth + GROUP_PADDING_X * 2);
    const projectHeight = Math.max(GROUP_MIN_HEIGHT, projectContentHeight + PROJECT_GROUP_PADDING_BOTTOM);

    const projectNode: ContextFlowNode = {
      id: projectNodeId,
      type: "projectGroup",
      position: {
        x: currentGroupX,
        y: 0,
      },
      style: {
        width: projectWidth,
        height: projectHeight,
      },
      data: {
        groupId: project,
        groupKind: "project",
        projectName: project,
        label: project,
        requiredWidth: projectWidth,
        requiredHeight: projectHeight,
      },
      draggable: true,
      selectable: true,
    };

    nodes.push(projectNode);
    defaultNodesById[projectNode.id] = { ...projectNode, data: { ...projectNode.data } };
    nodes.push(...pendingFeatureNodes);
    nodes.push(...pendingContextNodes);

    currentGroupX += projectWidth + GROUP_GAP_X;
  }

  for (const dependencyEdge of dependencyEdges) {
    const sourceNodeId = flowNodeIdByContextId.get(dependencyEdge.sourceContextId);
    const targetNodeId = flowNodeIdByContextId.get(dependencyEdge.targetContextId);
    if (!sourceNodeId || !targetNodeId) {
      continue;
    }

    const edgeColor = pickEdgeColor(dependencyEdge.id);
    edges.push({
      id: dependencyEdge.id,
      source: sourceNodeId,
      target: targetNodeId,
      sourceHandle: "out",
      targetHandle: "in",
      type: "smoothstep",
      animated: false,
      style: {
        strokeDasharray: "12 8",
        strokeWidth: 2,
        stroke: edgeColor,
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edgeColor,
      },
    });
  }

  return {
    nodes,
    edges,
    defaultNodesById,
  };
}
