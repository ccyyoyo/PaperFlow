import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { open } from '@tauri-apps/api/dialog';

import { PaperCommands } from '../ipc/commands';
import { DEFAULT_WORKSPACE_ID, useWorkspaceStore } from '../state/workspace-store';

export function WorkspaceSidebar() {
  const navigate = useNavigate();
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const papers = useWorkspaceStore((state) => state.papers);
  const isLoadingPapers = useWorkspaceStore((state) => state.isLoading);
  const isLoadingWorkspaces = useWorkspaceStore((state) => state.isWorkspacesLoading);
  const error = useWorkspaceStore((state) => state.error);
  const workspaceError = useWorkspaceStore((state) => state.workspaceError);
  const loadWorkspaces = useWorkspaceStore((state) => state.loadWorkspaces);
  const loadPapers = useWorkspaceStore((state) => state.loadPapers);
  const setActiveWorkspace = useWorkspaceStore((state) => state.setActiveWorkspace);
  const createWorkspace = useWorkspaceStore((state) => state.createWorkspace);
  const renameWorkspace = useWorkspaceStore((state) => state.renameWorkspace);
  const deleteWorkspace = useWorkspaceStore((state) => state.deleteWorkspace);
  const upsertPapers = useWorkspaceStore((state) => state.upsertPapers);
  const clearError = useWorkspaceStore((state) => state.clearError);
  const clearWorkspaceError = useWorkspaceStore((state) => state.clearWorkspaceError);

  const [isImporting, setIsImporting] = useState(false);
  const [status, setStatus] = useState<string | undefined>();
  const [workspaceStatus, setWorkspaceStatus] = useState<string | undefined>();

  useEffect(() => {
    void (async () => {
      await loadWorkspaces();
      await loadPapers();
    })();
  }, [loadWorkspaces, loadPapers]);

  const activeWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId),
    [workspaces, activeWorkspaceId]
  );

  const handleWorkspaceChange = async (nextId: string) => {
    if (!nextId || nextId === activeWorkspaceId) {
      return;
    }
    setActiveWorkspace(nextId);
    await loadPapers(nextId);
    setStatus(undefined);
    setWorkspaceStatus(undefined);
  };

  const handleCreateWorkspace = async () => {
    const name = window.prompt('Create workspace', '');
    if (!name) {
      return;
    }
    const created = await createWorkspace(name);
    if (created) {
      setWorkspaceStatus(`Workspace "${created.name}" created.`);
      setStatus(undefined);
    }
  };

  const handleRenameWorkspace = async () => {
    if (!activeWorkspace) {
      return;
    }
    const name = window.prompt('Rename workspace', activeWorkspace.name);
    if (!name || name.trim() === activeWorkspace.name) {
      return;
    }
    const updated = await renameWorkspace(activeWorkspace.id, name);
    if (updated) {
      setWorkspaceStatus(`Workspace renamed to "${updated.name}".`);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!activeWorkspace) {
      return;
    }
    if (
      activeWorkspace.id === DEFAULT_WORKSPACE_ID ||
      workspaces.length <= 1 ||
      !window.confirm(
        `Delete workspace "${activeWorkspace.name}"? This will remove its papers and notes.`
      )
    ) {
      return;
    }
    await deleteWorkspace(activeWorkspace.id);
    setWorkspaceStatus(`Workspace "${activeWorkspace.name}" deleted.`);
    setStatus(undefined);
  };

  const handleImport = async () => {
    if (isImporting) {
      return;
    }

    setIsImporting(true);
    setStatus(undefined);
    setWorkspaceStatus(undefined);
    try {
      const selection = await open({
        title: 'Import PDF',
        multiple: true,
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      });

      if (!selection) {
        return;
      }

      const paths = Array.isArray(selection) ? selection : [selection];
      if (paths.length === 0) {
        return;
      }

      const imported = await PaperCommands.import({
        paths,
        workspaceId: activeWorkspaceId
      });

      if (imported.length > 0) {
        upsertPapers(imported);
        setStatus(`Imported ${imported.length} PDF(s).`);
        navigate(`/papers/${imported[0].id}`);
      }
    } catch (err) {
      console.error('Failed to import papers', err);
      setStatus('Import failed, please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const canDeleteWorkspace =
    workspaces.length > 1 &&
    !!activeWorkspace &&
    activeWorkspace.id !== DEFAULT_WORKSPACE_ID &&
    !isLoadingWorkspaces;

  return (
    <aside className="workspace-sidebar">
      <header className="workspace-sidebar__header">
        <div className="workspace-sidebar__workspace">
          <div className="workspace-sidebar__workspace-label">
            <h2>{activeWorkspace?.name ?? 'Workspace'}</h2>
            <span className="workspace-sidebar__meta">ID: {activeWorkspaceId}</span>
          </div>
          <div className="workspace-sidebar__workspace-selector">
            <select
              id="workspace-select"
              value={activeWorkspaceId}
              onChange={(event) => void handleWorkspaceChange(event.target.value)}
              disabled={isLoadingWorkspaces || workspaces.length === 0}
              aria-label="Select workspace"
            >
              {workspaces.length === 0 && <option value="">No workspaces</option>}
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
            <div className="workspace-sidebar__workspace-actions">
              <button type="button" onClick={handleCreateWorkspace} disabled={isLoadingWorkspaces}>
                New
              </button>
              <button
                type="button"
                onClick={handleRenameWorkspace}
                disabled={isLoadingWorkspaces || !activeWorkspace}
              >
                Rename
              </button>
              <button
                type="button"
                onClick={handleDeleteWorkspace}
                disabled={!canDeleteWorkspace}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
        <div className="workspace-sidebar__actions">
          <button
            type="button"
            onClick={() => {
              setStatus(undefined);
              setWorkspaceStatus(undefined);
              void loadPapers();
            }}
            disabled={isLoadingPapers}
          >
            {isLoadingPapers ? 'Loading...' : 'Refresh'}
          </button>
          <button type="button" onClick={handleImport} disabled={isImporting || isLoadingWorkspaces}>
            {isImporting ? 'Importing...' : 'Import PDF'}
          </button>
        </div>
      </header>

      {(status || workspaceStatus || error || workspaceError) && (
        <div className="workspace-sidebar__status">
          {workspaceStatus && <p>{workspaceStatus}</p>}
          {status && <p>{status}</p>}
          {error && (
            <div className="workspace-sidebar__error" role="alert">
              <p>{error}</p>
              <button
                type="button"
                onClick={() => {
                  clearError();
                  setStatus(undefined);
                }}
              >
                Close
              </button>
            </div>
          )}
          {workspaceError && (
            <div className="workspace-sidebar__error" role="alert">
              <p>{workspaceError}</p>
              <button
                type="button"
                onClick={() => {
                  clearWorkspaceError();
                  setWorkspaceStatus(undefined);
                }}
              >
                Close
              </button>
            </div>
          )}
        </div>
      )}

      <ul className="workspace-paper-list">
        {papers.length === 0 && !isLoadingPapers ? (
          <li className="workspace-empty">No PDFs imported yet.</li>
        ) : (
          papers.map((paper) => (
            <li key={paper.id}>
              <Link to={`/papers/${paper.id}`}>{paper.title || paper.path}</Link>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}
