import type { ContextNodeEntity, UnresolvedDependency } from "@/features/context-graph/model/context-graph-types";

export interface ContextDependencyEdge {
  id: string;
  sourceContextId: string;
  targetContextId: string;
}

export interface ContextEdgeMapping {
  edges: ContextDependencyEdge[];
  unresolvedDependencies: UnresolvedDependency[];
}

export function mapDependencyEdges(contexts: ContextNodeEntity[]): ContextEdgeMapping {
  const contextIds = new Set(contexts.map((context) => context.id));
  const edges: ContextDependencyEdge[] = [];
  const unresolvedDependencies: UnresolvedDependency[] = [];

  for (const context of contexts) {
    for (const dependencyId of context.dependsOn) {
      if (!contextIds.has(dependencyId)) {
        unresolvedDependencies.push({ contextId: context.id, dependencyId });
        continue;
      }

      edges.push({
        id: `dep:${dependencyId}->${context.id}`,
        sourceContextId: dependencyId,
        targetContextId: context.id,
      });
    }
  }

  edges.sort((left, right) => left.id.localeCompare(right.id));
  unresolvedDependencies.sort((left, right) => {
    const leftKey = `${left.contextId}:${left.dependencyId}`;
    const rightKey = `${right.contextId}:${right.dependencyId}`;
    return leftKey.localeCompare(rightKey);
  });

  return {
    edges,
    unresolvedDependencies,
  };
}
