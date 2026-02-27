import { renderWorkspaceShellPage } from "@/features/workspace-shell/server/workspace-shell-page";

export default async function ForksPage() {
  return renderWorkspaceShellPage("forks");
}
