import type { ContextNodeEntity } from "@/features/context-graph/model/context-graph-types";

export interface ContextDetailsState {
  isOpen: boolean;
  selectedContext: ContextNodeEntity | null;
}

export function createContextDetailsInitialState(): ContextDetailsState {
  return {
    isOpen: false,
    selectedContext: null,
  };
}

export function openContextDetails(state: ContextDetailsState, context: ContextNodeEntity): ContextDetailsState {
  return {
    ...state,
    isOpen: true,
    selectedContext: context,
  };
}

export function closeContextDetails(state: ContextDetailsState): ContextDetailsState {
  if (!state.selectedContext) {
    return {
      ...state,
      isOpen: false,
    };
  }

  return {
    ...state,
    isOpen: false,
    selectedContext: null,
  };
}
