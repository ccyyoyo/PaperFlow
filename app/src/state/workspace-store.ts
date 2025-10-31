import { create } from 'zustand';

import { Paper } from '../types/paper';
import { PaperCommands } from '../ipc/commands';

export const DEFAULT_WORKSPACE_ID = 'default_workspace';

type WorkspaceState = {
  activeWorkspaceId: string;
  papers: Paper[];
  isLoading: boolean;
  error?: string;
  setActiveWorkspace: (id: string | null) => void;
  loadPapers: (workspaceId?: string | null) => Promise<void>;
  upsertPapers: (papers: Paper[]) => void;
  clearError: () => void;
};

function errorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return 'Unknown error occurred. Please try again later.';
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  activeWorkspaceId: DEFAULT_WORKSPACE_ID,
  papers: [],
  isLoading: false,
  error: undefined,
  setActiveWorkspace: (id) =>
    set({
      activeWorkspaceId: id && id.trim().length > 0 ? id : DEFAULT_WORKSPACE_ID
    }),
  loadPapers: async (workspaceId) => {
    const target =
      workspaceId && workspaceId.trim().length > 0 ? workspaceId : get().activeWorkspaceId;
    set({ isLoading: true, error: undefined });
    try {
      const papers = await PaperCommands.list(target);
      set({
        papers,
        activeWorkspaceId: target,
        isLoading: false
      });
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false });
    }
  },
  upsertPapers: (incoming) =>
    set((state) => {
      if (incoming.length === 0) {
        return state;
      }
      const merged = new Map<string, Paper>();
      state.papers.forEach((paper) => merged.set(paper.id, paper));
      incoming.forEach((paper) => merged.set(paper.id, paper));
      return { papers: Array.from(merged.values()) };
    }),
  clearError: () => set({ error: undefined })
}));
