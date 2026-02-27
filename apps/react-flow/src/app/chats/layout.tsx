import type { ReactNode } from "react";

import { mapDependencyEdges } from "@/features/context-graph/model/context-graph-edges";
import { loadContextGraphData } from "@/features/context-graph/server/context-graph-loader";
import { WorkspaceShellLayout } from "@/features/workspace-shell/components/workspace-shell-layout";

interface ChatsLayoutProps {
  children: ReactNode;
  params: Promise<{ conversationId?: string }>;
}

export default async function ChatsLayout({ children, params }: ChatsLayoutProps) {
  const graphData = await loadContextGraphData();
  const edgeMapping = mapDependencyEdges(graphData.contexts);
  const resolvedParams = await params;

  return (
    <main className="h-screen w-screen overflow-hidden">
      <WorkspaceShellLayout
        activeView="chats"
        graphData={graphData}
        edgeMapping={edgeMapping}
        initialSelectedChatConversationId={resolvedParams.conversationId ?? null}
      />
      <div className="hidden">{children}</div>
    </main>
  );
}
