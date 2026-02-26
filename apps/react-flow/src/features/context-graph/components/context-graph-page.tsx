import type { ContextEdgeMapping } from "@/features/context-graph/model/context-graph-edges";
import type { ContextGraphData } from "@/features/context-graph/model/context-graph-types";
import { ContextGraphCanvas } from "@/features/context-graph/components/context-graph-canvas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

interface ContextGraphPageProps {
  graphData: ContextGraphData;
  edgeMapping: ContextEdgeMapping;
}

export function ContextGraphPage({ graphData, edgeMapping }: ContextGraphPageProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader>
        <CardTitle>Dependency graph</CardTitle>
        <CardDescription>Click any context node to inspect full markdown content and metadata.</CardDescription>
      </CardHeader>
      <CardContent>
        <ContextGraphCanvas graphData={graphData} edgeMapping={edgeMapping} />
      </CardContent>
    </Card>
  );
}
