import type { Node } from "@xyflow/react";

const DEFAULT_NODE_WIDTH = 240;
const DEFAULT_NODE_HEIGHT = 96;

interface CollisionOptions {
  margin?: number;
  maxIterations?: number;
}

interface NodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function getNodeSize(node: Node): { width: number; height: number } {
  const styleWidth = typeof node.style?.width === "number" ? node.style.width : undefined;
  const styleHeight = typeof node.style?.height === "number" ? node.style.height : undefined;
  const measuredWidth = typeof node.measured?.width === "number" ? node.measured.width : undefined;
  const measuredHeight = typeof node.measured?.height === "number" ? node.measured.height : undefined;
  const width = styleWidth ?? node.width ?? measuredWidth ?? node.initialWidth ?? DEFAULT_NODE_WIDTH;
  const height = styleHeight ?? node.height ?? measuredHeight ?? node.initialHeight ?? DEFAULT_NODE_HEIGHT;

  return {
    width,
    height,
  };
}

function getNodeRect(node: Node, margin = 0): NodeRect {
  const size = getNodeSize(node);
  return {
    x: node.position.x - margin,
    y: node.position.y - margin,
    width: size.width + margin * 2,
    height: size.height + margin * 2,
  };
}

function overlaps(left: NodeRect, right: NodeRect): boolean {
  return (
    left.x < right.x + right.width &&
    left.x + left.width > right.x &&
    left.y < right.y + right.height &&
    left.y + left.height > right.y
  );
}

function clampToParentBounds<T extends Node>(node: T, nodesById: Map<string, T>): T {
  if (node.extent !== "parent" || !node.parentId) {
    return node;
  }

  const parent = nodesById.get(node.parentId);
  if (!parent) {
    return node;
  }

  const parentSize = getNodeSize(parent);
  const ownSize = getNodeSize(node);

  const maxX = Math.max(0, parentSize.width - ownSize.width);
  const maxY = Math.max(0, parentSize.height - ownSize.height);

  const nextX = Math.max(0, Math.min(node.position.x, maxX));
  const nextY = Math.max(0, Math.min(node.position.y, maxY));

  if (nextX === node.position.x && nextY === node.position.y) {
    return node;
  }

  return {
    ...node,
    position: {
      x: nextX,
      y: nextY,
    },
  };
}

export function hasSiblingCollision<T extends Node>(targetNode: T, nodes: T[], margin = 14): boolean {
  const targetRect = getNodeRect(targetNode, margin);

  for (const node of nodes) {
    if (node.id === targetNode.id || node.parentId !== targetNode.parentId) {
      continue;
    }

    if (overlaps(targetRect, getNodeRect(node, margin))) {
      return true;
    }
  }

  return false;
}

export function resolveNodeCollisions<T extends Node>(nodes: T[], options: CollisionOptions = {}): T[] {
  const margin = options.margin ?? 14;
  const maxIterations = options.maxIterations ?? 120;
  const nextNodes = nodes.map((node) => ({
    ...node,
    position: {
      x: node.position.x,
      y: node.position.y,
    },
  })) as T[];
  const indexById = new Map(nextNodes.map((node, index) => [node.id, index]));
  const nodesById = new Map<string, T>(nextNodes.map((node) => [node.id, node]));

  const moveNode = (node: T, dx: number, dy: number): boolean => {
    if (dx === 0 && dy === 0) {
      return false;
    }

    const index = indexById.get(node.id);
    if (index === undefined) {
      return false;
    }

    const candidate = clampToParentBounds(
      {
        ...node,
        position: {
          x: node.position.x + dx,
          y: node.position.y + dy,
        },
      },
      nodesById,
    ) as T;

    if (candidate.position.x === node.position.x && candidate.position.y === node.position.y) {
      return false;
    }

    nextNodes[index] = candidate;
    nodesById.set(candidate.id, candidate);
    return true;
  };

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    let changed = false;

    const siblingsByParent = new Map<string, T[]>();
    for (const node of nextNodes) {
      const key = node.parentId ?? "__root__";
      const existing = siblingsByParent.get(key) ?? [];
      existing.push(node);
      siblingsByParent.set(key, existing);
    }

    for (const siblings of siblingsByParent.values()) {
      for (let leftIndex = 0; leftIndex < siblings.length; leftIndex += 1) {
        for (let rightIndex = leftIndex + 1; rightIndex < siblings.length; rightIndex += 1) {
          const leftNode = siblings[leftIndex];
          const rightNode = siblings[rightIndex];

          if (!leftNode || !rightNode) {
            continue;
          }

          const leftRect = getNodeRect(leftNode, margin);
          const rightRect = getNodeRect(rightNode, margin);
          if (!overlaps(leftRect, rightRect)) {
            continue;
          }

          const overlapX = Math.min(leftRect.x + leftRect.width, rightRect.x + rightRect.width) - Math.max(leftRect.x, rightRect.x);
          const overlapY = Math.min(leftRect.y + leftRect.height, rightRect.y + rightRect.height) - Math.max(leftRect.y, rightRect.y);
          if (overlapX <= 0 || overlapY <= 0) {
            continue;
          }

          const centerDeltaX = leftRect.x + leftRect.width / 2 - (rightRect.x + rightRect.width / 2);
          const centerDeltaY = leftRect.y + leftRect.height / 2 - (rightRect.y + rightRect.height / 2);
          const moveLeft = leftNode.draggable !== false;
          const moveRight = rightNode.draggable !== false;

          if (!moveLeft && !moveRight) {
            continue;
          }

          const separateX = overlapX <= overlapY;
          const distance = separateX ? overlapX : overlapY;
          const direction = separateX ? (centerDeltaX <= 0 ? -1 : 1) : centerDeltaY <= 0 ? -1 : 1;

          if (moveLeft && moveRight) {
            const split = Math.ceil(distance / 2);
            changed = moveNode(leftNode, separateX ? split * direction : 0, separateX ? 0 : split * direction) || changed;
            changed = moveNode(rightNode, separateX ? -split * direction : 0, separateX ? 0 : -split * direction) || changed;
          } else if (moveLeft) {
            changed = moveNode(leftNode, separateX ? distance * direction : 0, separateX ? 0 : distance * direction) || changed;
          } else {
            changed = moveNode(rightNode, separateX ? -distance * direction : 0, separateX ? 0 : -distance * direction) || changed;
          }
        }
      }
    }

    if (!changed) {
      break;
    }
  }

  return nextNodes;
}
