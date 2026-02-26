export type NadStatusErrorCategory =
  | "binary_missing"
  | "command_timeout"
  | "command_failed"
  | "invalid_json"
  | "contract_missing_fields"
  | "invalid_context_target"
  | "no_active_run";

export interface NadCommandMetadata {
  binary: string;
  commandName: "orchestration.status";
  args: string[];
  durationMs: number;
  exitStatus: number | null;
  timedOut: boolean;
}

export interface NadStatusAdapterError {
  category: NadStatusErrorCategory;
  message: string;
  remediation: string;
  source: NadCommandMetadata;
}

export interface NadPipelineStatus {
  contextFile: string;
  pipelineName: string | null;
  runId: number | null;
  status: string;
  terminalReason: string | null;
  startedAt: number | null;
  endedAt: number | null;
  message: string;
  remediation: string | null;
  activeRunIds: number[];
}

export interface NadStatusResult {
  payload: NadPipelineStatus;
  command: NadCommandMetadata;
}
