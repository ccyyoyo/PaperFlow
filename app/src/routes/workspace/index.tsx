import { Link } from 'react-router-dom';

import { WorkspaceSidebar } from '../../components/workspace-sidebar';
import { QuickNote } from '../../components/quick-note';
import { ReviewDashboard } from '../../components/review-dashboard';
import { useWorkspaceStore } from '../../state/workspace-store';

export function WorkspacePage() {
  const activeWorkspaceId = useWorkspaceStore((state) => state.activeWorkspaceId);
  const activeWorkspaceName = useWorkspaceStore((state) => {
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
    return workspace?.name ?? state.activeWorkspaceId;
  });
  const papers = useWorkspaceStore((state) => state.papers);

  return (
    <div className="workspace-grid">
      <WorkspaceSidebar />
      <main className="workspace-main">
        <header className="workspace-header">
          <div>
            <h1>PaperFlow workspace</h1>
            <p className="workspace-subtitle">
              Active workspace: <strong>{activeWorkspaceName}</strong> (ID: {activeWorkspaceId}) -{' '}
              {papers.length} paper(s)
            </p>
          </div>
          <nav>
            <Link to="/review">Open review dashboard</Link>
          </nav>
        </header>
        <section className="workspace-content">
          <p>
            Browse or import PDFs from the sidebar, annotate them with focused notes, and trigger quick search to find
            ideas instantly. Use the quick note panel for lightweight capture and keep an eye on upcoming reviews.
          </p>
        </section>
        <section className="workspace-widgets">
          <QuickNote />
          <ReviewDashboard />
        </section>
      </main>
    </div>
  );
}
