import { beforeEach, describe, expect, it } from 'vitest';

import { useWorkspaceStore, DEFAULT_WORKSPACE_ID } from '../state/workspace-store';
import { PaperCommands } from '../ipc/commands';

describe('useWorkspaceStore', () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      activeWorkspaceId: DEFAULT_WORKSPACE_ID,
      papers: [],
      isLoading: false,
      error: undefined
    });
  });

  it('loads papers for the specified workspace', async () => {
    PaperCommands.list.mockResolvedValue([
      {
        id: 'paper-1',
        workspaceId: 'workspace-a',
        title: 'Test Paper',
        doi: undefined,
        path: 'C:/paper.pdf',
        lastSeenPath: 'C:/paper.pdf',
        fileHash: 'hash',
        filesize: 1024,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z'
      }
    ]);

    await useWorkspaceStore.getState().loadPapers('workspace-a');

    expect(PaperCommands.list).toHaveBeenCalledWith('workspace-a');
    expect(useWorkspaceStore.getState().papers).toHaveLength(1);
    expect(useWorkspaceStore.getState().activeWorkspaceId).toBe('workspace-a');
    expect(useWorkspaceStore.getState().error).toBeUndefined();
  });

  it('stores error message when loading fails', async () => {
    PaperCommands.list.mockRejectedValue(new Error('network down'));

    await useWorkspaceStore.getState().loadPapers('workspace-b');

    expect(PaperCommands.list).toHaveBeenCalledWith('workspace-b');
    expect(useWorkspaceStore.getState().isLoading).toBe(false);
    expect(useWorkspaceStore.getState().error).toContain('network down');
  });
});
