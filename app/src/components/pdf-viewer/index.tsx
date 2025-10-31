import { useEffect, useMemo, useRef, useState } from 'react';
import { readBinaryFile } from '@tauri-apps/api/fs';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.js?url';
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist/types/src/display/api';

import { Paper } from '../../types/paper';
import { PaperCommands } from '../../ipc/commands';
import { useViewerStore } from '../../state/viewer-store';

type PdfViewerProps = {
  paperId: string;
};

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;

GlobalWorkerOptions.workerSrc = workerSrc;

export function PdfViewer({ paperId }: PdfViewerProps) {
  const [paper, setPaper] = useState<Paper | null>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { request: viewerRequest, clearRequest: clearViewerRequest } = useViewerStore((state) => ({
    request: state.request,
    clearRequest: state.clearRequest
  }));
  const resolvedPaperId = paper?.id ?? paperId;

  useEffect(() => {
    let cancelled = false;

    if (!paperId) {
      setPaper(null);
      setPdf(null);
      setNumPages(0);
      setPageNumber(1);
      setScale(1);
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
          setPaper(null);
          setError('Unable to open PDF');
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

  useEffect(() => {
    let cancelled = false;
    let pdfInstance: PDFDocumentProxy | null = null;

    const loadPdf = async () => {
      setPdf(null);
      setNumPages(0);
      setPageNumber(1);

      if (!paper?.path) {
        return;
      }

      setIsLoading(true);
      setError(undefined);
      setScale(1);
      try {
        const bytes = await readBinaryFile(paper.path);
        const document = await getDocument({ data: bytes }).promise;
        if (cancelled) {
          document.destroy();
          return;
        }
        pdfInstance = document;
        setPdf(document);
        setNumPages(document.numPages);
        setPageNumber(1);
      } catch (err) {
        console.error('Failed to load PDF file', err);
        if (!cancelled) {
          setPdf(null);
          setNumPages(0);
          setPageNumber(1);
          setError('Unable to load PDF file');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadPdf();

    return () => {
      cancelled = true;
      if (pdfInstance) {
        pdfInstance.destroy();
      }
    };
  }, [paper?.path]);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | null = null;

    const renderPage = async () => {
      if (!pdf) {
        return;
      }

      setError((current) => (current === 'Unable to render PDF page' ? undefined : current));
      setIsRendering(true);
      try {
        const safePageNumber = Math.min(Math.max(pageNumber, 1), pdf.numPages);
        if (safePageNumber !== pageNumber) {
          setPageNumber(safePageNumber);
          return;
        }

        const page: PDFPageProxy = await pdf.getPage(pageNumber);
        if (cancelled) {
          return;
        }

        const canvas = canvasRef.current;
        const context = canvas?.getContext('2d');
        if (!canvas || !context) {
          console.warn('PDF canvas is not ready for rendering');
          return;
        }

        const viewport = page.getViewport({ scale });

        if (canvas.width !== viewport.width || canvas.height !== viewport.height) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
        } else {
          context.clearRect(0, 0, canvas.width, canvas.height);
        }

        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to render PDF page', err);
          setError('Unable to render PDF page');
        }
      } finally {
        if (!cancelled) {
          setIsRendering(false);
        }
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
      if (renderTask) {
        renderTask.cancel();
      }
    };
  }, [pdf, pageNumber, scale]);

  useEffect(() => {
    if (!viewerRequest) {
      return;
    }
    if (!resolvedPaperId || viewerRequest.paperId !== resolvedPaperId) {
      return;
    }

    if (typeof viewerRequest.page === 'number') {
      const requestedPage = Math.max(1, Math.floor(viewerRequest.page));
      if (pdf) {
        const boundedPage = Math.min(pdf.numPages, requestedPage);
        setPageNumber(boundedPage);
        clearViewerRequest();
      } else {
        setPageNumber(requestedPage);
      }
    } else {
      clearViewerRequest();
    }
  }, [viewerRequest, resolvedPaperId, pdf, clearViewerRequest]);

  const canGoPrevious = useMemo(() => pageNumber > 1, [pageNumber]);
  const canGoNext = useMemo(() => (pdf ? pageNumber < pdf.numPages : false), [pdf, pageNumber]);

  const zoomLabel = useMemo(() => `${Math.round(scale * 100)}%`, [scale]);

  const handlePageInput = (value: string) => {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= numPages) {
      setPageNumber(parsed);
    }
  };

  const handleZoomOut = () => setScale((current) => Math.max(MIN_SCALE, current - SCALE_STEP));
  const handleZoomIn = () => setScale((current) => Math.min(MAX_SCALE, current + SCALE_STEP));
  const goToPreviousPage = () => setPageNumber((value) => Math.max(1, value - 1));
  const goToNextPage = () => {
    if (!pdf) {
      return;
    }
    setPageNumber((value) => Math.min(pdf.numPages, value + 1));
  };

  const handleFitWidth = async () => {
    if (!pdf) {
      return;
    }
    const container = containerRef.current;
    if (!container) {
      return;
    }
    try {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const availableWidth = container.clientWidth;
      if (availableWidth > 0) {
        const fittedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, availableWidth / viewport.width));
        setScale(fittedScale);
      }
    } catch (err) {
      console.error('Failed to fit PDF width', err);
    }
  };

  return (
    <section className="pdf-viewer">
      <header className="pdf-toolbar">
        <div className="pdf-toolbar__meta">
          <span className="pdf-title">{paper?.title ?? 'No paper selected'}</span>
          {paper && <span className="pdf-path">{paper.path}</span>}
        </div>
        <div className="pdf-toolbar__controls">
          <button type="button" onClick={goToPreviousPage} disabled={!canGoPrevious || isRendering}>
            Previous
          </button>
          <span className="pdf-toolbar__page">
            Page
            <input
              type="number"
              min={1}
              max={numPages || 1}
              value={numPages ? pageNumber : ''}
              onChange={(event) => handlePageInput(event.target.value)}
              disabled={!pdf}
            />
            <span>of {numPages || '--'}</span>
          </span>
          <button type="button" onClick={goToNextPage} disabled={!canGoNext || isRendering}>
            Next
          </button>
          <span className="pdf-toolbar__zoom">
            <button type="button" onClick={handleZoomOut} disabled={!pdf || scale <= MIN_SCALE}>
              -
            </button>
            <span>{zoomLabel}</span>
            <button type="button" onClick={handleZoomIn} disabled={!pdf || scale >= MAX_SCALE}>
              +
            </button>
            <button type="button" onClick={handleFitWidth} disabled={!pdf}>
              Fit width
            </button>
          </span>
        </div>
        <div className="pdf-status">
          {isLoading && <span>Loading...</span>}
          {!isLoading && isRendering && <span>Rendering...</span>}
          {error && <span className="pdf-error">{error}</span>}
        </div>
      </header>
      <div className="pdf-canvas-container" ref={containerRef}>
        {paper && pdf ? (
          <canvas ref={canvasRef} className="pdf-canvas" />
        ) : (
          <div className="pdf-empty">
            <p>{paper ? 'Preparing viewer...' : 'Select or import a PDF from the sidebar.'}</p>
          </div>
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
