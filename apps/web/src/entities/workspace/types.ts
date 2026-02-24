export type ContextOption = {
  contextId: string;
  title: string;
  filePath: string;
};

export type WorkspaceFileGroup = "context" | "rules" | "reference";

export type WorkspaceFile = {
  path: string;
  name: string;
  group: WorkspaceFileGroup;
  readOnly: boolean;
  updatedAt: string;
  mtimeMs: number;
};

export type WorkspaceLoadedFile = {
  file: WorkspaceFile;
  content: string;
};

export type NextActionRow = {
  description: string;
  testId: string;
};

export type TaskStatus = "implemented" | "failed" | "missing" | "in-progress" | "unknown";

export type TaskStatusSnapshot = {
  status: TaskStatus;
  runId: number | null;
  timestamp: number | null;
  details: string | null;
};

export type LiveEvent = {
  id: string;
  timestamp: number;
  level: "info" | "warn" | "error";
  message: string;
};

export type LiveSessionSnapshot = {
  active: boolean;
  provider: string;
  sessionId: string;
  events: LiveEvent[];
  hint: string;
};
