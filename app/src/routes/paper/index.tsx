import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { PdfViewer } from '../../components/pdf-viewer';
import { NoteEditor } from '../../components/note-editor';
import { SearchPanel } from '../../components/search-panel';
import { useWorkspaceStore } from '../../state/workspace-store';

export function PaperPage() {
  const { paperId } = useParams();
  const papers = useWorkspaceStore((state) => state.papers);

  const resolvedPaper = useMemo(() => {
    if (!paperId) {
      return undefined;
    }
    return papers.find((paper) => paper.id === paperId);
  }, [papers, paperId]);

  const resolvedPaperId = resolvedPaper?.id ?? paperId ?? '';

  return (
    <div className="paper-layout">
      <PdfViewer paperId={resolvedPaperId} />
      <aside className="paper-sidebar">
        <NoteEditor paperId={resolvedPaperId} paperTitle={resolvedPaper?.title} />
        <SearchPanel />
      </aside>
    </div>
  );
}
