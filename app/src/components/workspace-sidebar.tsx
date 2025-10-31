import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { open } from '@tauri-apps/api/dialog';

import { PaperCommands } from '../ipc/commands';
import { useWorkspaceStore } from '../state/workspace-store';

export function WorkspaceSidebar() {
  const navigate = useNavigate();
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const papers = useWorkspaceStore((state) => state.papers);
  const isLoading = useWorkspaceStore((state) => state.isLoading);
  const error = useWorkspaceStore((state) => state.error);
  const loadPapers = useWorkspaceStore((state) => state.loadPapers);
  const upsertPapers = useWorkspaceStore((state) => state.upsertPapers);
  const clearError = useWorkspaceStore((state) => state.clearError);
  const [isImporting, setIsImporting] = useState(false);
  const [status, setStatus] = useState<string | undefined>();

  useEffect(() => {
    void loadPapers();
  }, [loadPapers]);

  const handleImport = async () => {
    if (isImporting) {
      return;
    }

    setIsImporting(true);
    setStatus(undefined);
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
        setStatus(`Imported ${imported.length} PDF(s)`);
        navigate(`/papers/${imported[0].id}`);
      }
    } catch (err) {
      console.error('Failed to import papers', err);
      setStatus('Import failed, please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <aside className="workspace-sidebar">
      <header className="workspace-sidebar__header">
        <div>
          <h2>Workspace</h2>
          <span className="workspace-sidebar__meta">ID: {activeWorkspaceId}</span>
        </div>
        <div className="workspace-sidebar__actions">
          <button type="button" onClick={() => loadPapers()} disabled={isLoading}>
            {isLoading ? 'Loading…' : 'Refresh'}
          </button>
          <button type="button" onClick={handleImport} disabled={isImporting}>
            {isImporting ? 'Importing…' : 'Import PDF'}
          </button>
        </div>
      </header>

      {(status || error) && (
        <div className="workspace-sidebar__status">
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
        </div>
      )}

      <ul className="workspace-paper-list">
        {papers.length === 0 && !isLoading ? (
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
