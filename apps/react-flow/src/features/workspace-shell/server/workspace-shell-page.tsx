import { mapDependencyEdges } from "@/features/context-graph/model/context-graph-edges";
import { loadContextGraphData } from "@/features/context-graph/server/context-graph-loader";
import { WorkspaceShellLayout } from "@/features/workspace-shell/components/workspace-shell-layout";
import type { WorkspaceView } from "@/features/workspace-shell/model/workspace-view";

export async function renderWorkspaceShellPage(activeView: WorkspaceView, selectedChatConversationId?: string) {
  const graphData = await loadContextGraphData();
  const edgeMapping = mapDependencyEdges(graphData.contexts);

  return (
    <main className="h-screen w-screen overflow-hidden">
      <WorkspaceShellLayout
        activeView={activeView}
        graphData={graphData}
        edgeMapping={edgeMapping}
        initialSelectedChatConversationId={selectedChatConversationId ?? null}
      />
    </main>
  );
}
