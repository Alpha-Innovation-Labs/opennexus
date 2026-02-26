import { ContextGraphCanvas } from "@/features/context-graph/components/context-graph-canvas";
import { mapDependencyEdges } from "@/features/context-graph/model/context-graph-edges";
import { loadContextGraphData } from "@/features/context-graph/server/context-graph-loader";
import { OpencodeConversationPanel } from "@/features/opencode-panel/components/opencode-conversation-panel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/shared/ui/resizable";

export default async function HomePage() {
  const graphData = await loadContextGraphData();
  const edgeMapping = mapDependencyEdges(graphData.contexts);

  return (
    <main className="h-screen w-screen overflow-hidden">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize="74%" minSize="50%">
          <section className="h-full min-w-0">
            <ContextGraphCanvas graphData={graphData} edgeMapping={edgeMapping} />
          </section>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize="26%" minSize="18%" maxSize="50%">
          <section className="h-full min-w-[300px]">
            <OpencodeConversationPanel />
          </section>
        </ResizablePanel>
      </ResizablePanelGroup>
    </main>
  );
}
