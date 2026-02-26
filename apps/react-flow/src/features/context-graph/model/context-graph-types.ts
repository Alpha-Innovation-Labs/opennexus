export interface ProjectGroupEntity {
  id: string;
  label: string;
}

export interface ContextNodeEntity {
  id: string;
  title: string;
  project: string;
  feature: string;
  featureTitle: string;
  isAdapterAuthored: boolean;
  path: string;
  content: string;
  dependsOn: string[];
}

export interface UnresolvedDependency {
  contextId: string;
  dependencyId: string;
}

export interface ContextGraphData {
  projects: ProjectGroupEntity[];
  contexts: ContextNodeEntity[];
  unresolvedDependencies: UnresolvedDependency[];
}
