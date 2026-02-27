export type RunInput = {
  pipelineFile?: string;
  configFile?: string;
  context?: Record<string, unknown>;
};

export type PipelineStep = {
  id: string;
  block_id: string;
  params?: Record<string, unknown>;
};

export type PipelineDefinition = {
  name: string;
  steps: PipelineStep[];
};

export type StepOutput = Record<string, unknown>;

export type PipelineRuntimeState = {
  defaultWorkingDirectory: string;
};

export type PipelineState = {
  input: RunInput;
  config: Record<string, unknown>;
  steps: Record<string, StepOutput>;
  runtime: PipelineRuntimeState;
};

export type BlockExecutionContext = {
  step: PipelineStep;
  params: Record<string, unknown>;
  state: PipelineState;
};

export type PipelineBlock = {
  id: string;
  run: (context: BlockExecutionContext) => Promise<StepOutput>;
};
