import { create } from 'zustand';

import { Paper } from '../types/paper';
import { Workspace } from '../types/workspace';
import { PaperCommands, WorkspaceCommands } from '../ipc/commands';

export const DEFAULT_WORKSPACE_ID = 'default_workspace';

type WorkspaceState = {
  workspaces: Workspace[];
  activeWorkspaceId: string;
  papers: Paper[];
  isLoading: boolean;
  isWorkspacesLoading: boolean;
  error?: string;
  workspaceError?: string;
  setActiveWorkspace: (id: string | null) => void;
  loadWorkspaces: () => Promise<void>;
  loadPapers: (workspaceId?: string | null) => Promise<void>;
  createWorkspace: (name: string) => Promise<Workspace | undefined>;
  renameWorkspace: (id: string, name: string) => Promise<Workspace | undefined>;
  deleteWorkspace: (id: string) => Promise<void>;
  upsertPapers: (papers: Paper[]) => void;
  clearError: () => void;
  clearWorkspaceError: () => void;
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

function sortWorkspaces(workspaces: Workspace[]): Workspace[] {
  return [...workspaces].sort((a, b) => a.name.localeCompare(b.name));
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspaceId: DEFAULT_WORKSPACE_ID,
  papers: [],
  isLoading: false,
  isWorkspacesLoading: false,
  error: undefined,
  workspaceError: undefined,
  setActiveWorkspace: (id) =>
    set((state) => {
      const requested = id && id.trim().length > 0 ? id.trim() : DEFAULT_WORKSPACE_ID;
      if (state.workspaces.length === 0) {
        return { activeWorkspaceId: requested };
      }
      const exists = state.workspaces.some((workspace) => workspace.id === requested);
      if (exists) {
        return { activeWorkspaceId: requested };
      }
      return { activeWorkspaceId: state.workspaces[0].id };
    }),
  loadWorkspaces: async () => {
    set({ isWorkspacesLoading: true, workspaceError: undefined });
    try {
      const fetched = await WorkspaceCommands.list();
      const workspaces = sortWorkspaces(fetched);
      set((state) => {
        const hasActive = workspaces.some(
          (workspace) => workspace.id === state.activeWorkspaceId
        );
        const nextActive =
          hasActive && state.activeWorkspaceId
            ? state.activeWorkspaceId
            : workspaces[0]?.id ?? DEFAULT_WORKSPACE_ID;
        return {
          workspaces,
          activeWorkspaceId: nextActive,
          isWorkspacesLoading: false
        };
      });
    } catch (error) {
      set({ workspaceError: errorMessage(error), isWorkspacesLoading: false });
    }
  },
  loadPapers: async (workspaceId) => {
    const targetId =
      workspaceId && workspaceId.trim().length > 0 ? workspaceId.trim() : get().activeWorkspaceId;
    set({ isLoading: true, error: undefined });
    try {
      const papers = await PaperCommands.list(targetId);
      set({
        papers,
        activeWorkspaceId: targetId,
        isLoading: false
      });
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false });
    }
  },
  createWorkspace: async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      set({ workspaceError: 'Workspace name is required' });
      return undefined;
    }
    set({ workspaceError: undefined });
    try {
      const workspace = await WorkspaceCommands.create(trimmed);
      set((state) => ({
        workspaces: sortWorkspaces([...state.workspaces, workspace]),
        activeWorkspaceId: workspace.id
      }));
      await get().loadPapers(workspace.id);
      return workspace;
    } catch (error) {
      set({ workspaceError: errorMessage(error) });
      return undefined;
    }
  },
  renameWorkspace: async (id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      set({ workspaceError: 'Workspace name is required' });
      return undefined;
    }
    set({ workspaceError: undefined });
    try {
      const updated = await WorkspaceCommands.rename(id, trimmed);
      set((state) => ({
        workspaces: sortWorkspaces(
          state.workspaces.map((workspace) => (workspace.id === updated.id ? updated : workspace))
        )
      }));
      return updated;
    } catch (error) {
      set({ workspaceError: errorMessage(error) });
      return undefined;
    }
  },
  deleteWorkspace: async (id: string) => {
    set({ workspaceError: undefined });
    try {
      await WorkspaceCommands.remove(id);
      let shouldReload = false;
      set((state) => {
        const remaining = state.workspaces.filter((workspace) => workspace.id !== id);
        const wasActive = state.activeWorkspaceId === id;
        const nextActive = wasActive
          ? remaining[0]?.id ?? DEFAULT_WORKSPACE_ID
          : state.activeWorkspaceId;
        if (wasActive) {
          shouldReload = true;
        }
        return {
          workspaces: remaining,
          activeWorkspaceId: nextActive,
          papers: wasActive ? [] : state.papers
        };
      });
      if (shouldReload) {
        await get().loadPapers(get().activeWorkspaceId);
      }
    } catch (error) {
      set({ workspaceError: errorMessage(error) });
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
  clearError: () => set({ error: undefined }),
  clearWorkspaceError: () => set({ workspaceError: undefined })
}));
