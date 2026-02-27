import { mapDependencyEdges } from "@/features/context-graph/model/context-graph-edges";
import { loadContextGraphData } from "@/features/context-graph/server/context-graph-loader";
import { WorkspaceShellLayout } from "@/features/workspace-shell/components/workspace-shell-layout";
import type { WorkspaceView } from "@/features/workspace-shell/model/workspace-view";

interface HomePageProps {
  searchParams: Promise<{ view?: string }>;
}

function normalizeView(view: string | undefined): WorkspaceView {
  if (view === "forks") {
    return "forks";
  }
  if (view === "chats") {
    return "chats";
  }
  if (view === "workflows") {
    return "workflows";
  }
  return "context";
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const params = await searchParams;
  const activeView = normalizeView(params.view);
  const graphData = await loadContextGraphData();
  const edgeMapping = mapDependencyEdges(graphData.contexts);

  return (
    <main className="h-screen w-screen overflow-hidden">
      <WorkspaceShellLayout activeView={activeView} graphData={graphData} edgeMapping={edgeMapping} />
    </main>
  );
}
