import { useEffect, useState } from 'react';

import { Paper } from '../../types/paper';
import { PaperCommands } from '../../ipc/commands';

type PdfViewerProps = {
  paperId: string;
};

export function PdfViewer({ paperId }: PdfViewerProps) {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    if (!paperId) {
      setPaper(null);
      return;
    }

    const loadPaper = async () => {
      setIsLoading(true);
      setError(undefined);
      try {
        const result = await PaperCommands.open(paperId);
        if (!cancelled) {
          setPaper(result);
        }
      } catch (err) {
        console.error('Failed to open paper', err);
        if (!cancelled) {
          setError('Unable to load PDF');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadPaper();
    return () => {
      cancelled = true;
    };
  }, [paperId]);

  return (
    <section className="pdf-viewer">
      <header className="pdf-toolbar">
        <div>
          <span className="pdf-title">{paper?.title ?? 'No paper selected'}</span>
          {paper && <span className="pdf-path">{paper.path}</span>}
        </div>
        <div className="pdf-status">
          {isLoading && <span>Loading…</span>}
          {error && <span className="pdf-error">{error}</span>}
        </div>
      </header>
      <div className="pdf-canvas-placeholder">
        {paper ? (
          <p>pdf.js viewer placeholder — rendering {paper.title || paper.path}</p>
        ) : (
          <p>Select or import a PDF from the sidebar.</p>
        )}
      </div>
      {paper && (
        <footer className="pdf-footer">
          <span>Created at: {paper.createdAt}</span>
          <span>Updated at: {paper.updatedAt}</span>
          {paper.filesize && <span>Size: {(paper.filesize / (1024 * 1024)).toFixed(2)} MB</span>}
        </footer>
      )}
    </section>
  );
}
