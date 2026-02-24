import { Suspense } from "react";

import { WorkspaceShell } from "@/features/workspace/components/workspace-shell";

export default function HomePage() {
  return (
    <Suspense fallback={<main className="p-6 text-sm text-muted-foreground">Loading workspace...</main>}>
      <WorkspaceShell />
    </Suspense>
  );
}
