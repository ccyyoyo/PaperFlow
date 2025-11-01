import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/api/dialog";
import { convertFileSrc } from "@tauri-apps/api/tauri";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import type {
  PDFDocumentProxy,
  PDFPageProxy,
} from "pdfjs-dist/types/src/display/api";
const workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

GlobalWorkerOptions.workerSrc = workerSrc;

type PdfSource = {
  url: string;
  label: string;
  originalPath?: string;
  cleanup?: () => void;
};

type RecentFile = {
  label: string;
  path: string | null;
  openedAt: number;
};

const isTauriRuntime =
  typeof window !== "undefined" && Boolean((window as any).__TAURI_IPC__);
const storageAvailable =
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const RECENT_FILES_KEY = "paperflow:recentFiles";
const LAST_PAGE_KEY = "paperflow:lastPageMap";
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;
const DEFAULT_SCALE = 1.25;
const RECENT_LIMIT = 6;

function extractFileName(path: string) {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] ?? path;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readRecentFiles(): RecentFile[] {
  if (!storageAvailable) return [];
  try {
    const raw = window.localStorage.getItem(RECENT_FILES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentFile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("Unable to parse recent files", error);
    return [];
  }
}

function persistRecentFiles(files: RecentFile[]) {
  if (!storageAvailable) return;
  try {
    window.localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(files));
  } catch (error) {
    console.warn("Unable to persist recent files", error);
  }
}

function readLastPageMap(): Record<string, number> {
  if (!storageAvailable) return {};
  try {
    const raw = window.localStorage.getItem(LAST_PAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    console.warn("Unable to parse last page map", error);
    return {};
  }
}

function persistLastPageMap(map: Record<string, number>) {
  if (!storageAvailable) return;
  try {
    window.localStorage.setItem(LAST_PAGE_KEY, JSON.stringify(map));
  } catch (error) {
    console.warn("Unable to persist last page map", error);
  }
}

function getSourceKey(ref: { originalPath?: string; label: string }) {
  return ref.originalPath ?? ref.label;
}

export function PdfViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const [pageInput, setPageInput] = useState("1");
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>(
    () => readRecentFiles()
  );
  const [lastPageMap, setLastPageMap] = useState<Record<string, number>>(
    () => readLastPageMap()
  );

  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [source, setSource] = useState<PdfSource | null>(null);

  const renderPage = useCallback(
    async (doc: PDFDocumentProxy, page: number, pageScale: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const pdfPage: PDFPageProxy = await doc.getPage(page);
      const viewport = pdfPage.getViewport({ scale: pageScale });
      const context = canvas.getContext("2d");

      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await pdfPage.render({ canvasContext: context, viewport }).promise;
    },
    []
  );

  const updateRecentFiles = useCallback((entry: RecentFile) => {
    setRecentFiles((previous) => {
      const filtered = previous.filter((item) =>
        entry.path
          ? item.path !== entry.path
          : item.label !== entry.label || Boolean(item.path)
      );
      const next = [entry, ...filtered].slice(0, RECENT_LIMIT);
      persistRecentFiles(next);
      return next;
    });
  }, []);

  const loadPdf = useCallback(
    async (pdfSource: PdfSource) => {
      if (source?.cleanup) {
        source.cleanup();
      }

      setStatus("loading");
      setErrorMessage(null);
      setSource(pdfSource);

      try {
        const task = getDocument(pdfSource.url);
        const doc = await task.promise;

        const key = getSourceKey(pdfSource);
        const savedPage = lastPageMap[key];
        const initialPage = savedPage
          ? Math.min(Math.max(savedPage, 1), doc.numPages)
          : 1;

        setPdfDocument(doc);
        setPageCount(doc.numPages);
        setScale(DEFAULT_SCALE);
        setPageNumber(initialPage);
        setPageInput(initialPage.toString());
        setStatus("ready");

        updateRecentFiles({
          label: pdfSource.label,
          path: pdfSource.originalPath ?? null,
          openedAt: Date.now(),
        });
      } catch (error) {
        console.error("Failed to load PDF", error);
        setErrorMessage("無法載入 PDF，請再試一次或選擇其他檔案。");
        setPdfDocument(null);
        setPageNumber(1);
        setPageCount(0);
        setStatus("error");
      }
    },
    [lastPageMap, source, updateRecentFiles]
  );

  useEffect(() => {
    if (!pdfDocument || status !== "ready") return;
    renderPage(pdfDocument, pageNumber, scale);
  }, [pdfDocument, pageNumber, renderPage, scale, status]);

  useEffect(() => {
    return () => {
      if (source?.cleanup) {
        source.cleanup();
      }
    };
  }, [source]);

  useEffect(() => {
    setPageInput(pageNumber.toString());
  }, [pageNumber]);

  useEffect(() => {
    if (!source || status !== "ready") return;
    const key = getSourceKey(source);
    setLastPageMap((prev) => {
      const next = { ...prev, [key]: pageNumber };
      persistLastPageMap(next);
      return next;
    });
  }, [pageNumber, source, status]);

  const handlePickClick = async () => {
    if (isTauriRuntime) {
      const selected = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });

      if (typeof selected === "string") {
        const url = await convertFileSrc(selected);
        const label = extractFileName(selected);
        loadPdf({ url, label, originalPath: selected });
      }

      return;
    }

    inputRef.current?.click();
  };

  const handleFileInput = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);

    loadPdf({
      url,
      label: file.name,
      cleanup: () => URL.revokeObjectURL(url),
    });
  };

  const handleRecentOpen = async (entry: RecentFile) => {
    if (!entry.path || !isTauriRuntime) return;
    const url = await convertFileSrc(entry.path);
    loadPdf({ url, label: entry.label, originalPath: entry.path });
  };

  const handlePrevPage = () => {
    setPageNumber((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setPageNumber((prev) => Math.min(pageCount, prev + 1));
  };

  const handlePageSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status !== "ready") return;
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isNaN(parsed)) return;
    setPageNumber(clamp(parsed, 1, pageCount));
  };

  const handleZoomIn = () => {
    setScale((prev) => Math.min(MAX_SCALE, Number((prev + SCALE_STEP).toFixed(2))));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(MIN_SCALE, Number((prev - SCALE_STEP).toFixed(2))));
  };

  const handleZoomReset = () => {
    setScale(DEFAULT_SCALE);
  };

  const scaleDisplay = useMemo(
    () => `${Math.round(scale * 100)}%`,
    [scale]
  );

  return (
    <section className="pdf-viewer">
      <div className="pdf-viewer__toolbar">
        <div className="pdf-viewer__actions">
          <button className="pdf-viewer__button" onClick={handlePickClick}>
            選擇 PDF
          </button>

          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileInput}
            style={{ display: "none" }}
          />

          <div className="pdf-viewer__info">
            {status === "loading" && <span>載入中...</span>}
            {status === "ready" && (
              <span>
                {source?.label ?? "未命名"} ・ 第 {pageNumber} / {pageCount} 頁
              </span>
            )}
            {status === "error" && (
              <span className="pdf-viewer__error">{errorMessage}</span>
            )}
            {status === "idle" && <span>尚未選擇檔案</span>}
          </div>
        </div>

        <div className="pdf-viewer__controls">
          <div className="pdf-viewer__nav">
            <button
              className="pdf-viewer__button"
              onClick={handlePrevPage}
              disabled={pageNumber <= 1 || status !== "ready"}
            >
              上一頁
            </button>
            <form className="pdf-viewer__page-jump" onSubmit={handlePageSubmit}>
              <input
                className="pdf-viewer__page-input"
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
              />
              <span>/ {pageCount || "—"}</span>
              <button
                className="pdf-viewer__button pdf-viewer__button--ghost"
                type="submit"
                disabled={status !== "ready"}
              >
                跳轉
              </button>
            </form>
            <button
              className="pdf-viewer__button"
              onClick={handleNextPage}
              disabled={pageNumber >= pageCount || status !== "ready"}
            >
              下一頁
            </button>
          </div>

          <div className="pdf-viewer__zoom">
            <button
              className="pdf-viewer__button pdf-viewer__button--ghost"
              onClick={handleZoomOut}
              disabled={scale <= MIN_SCALE}
            >
              -
            </button>
            <span className="pdf-viewer__zoom-display">{scaleDisplay}</span>
            <button
              className="pdf-viewer__button pdf-viewer__button--ghost"
              onClick={handleZoomIn}
              disabled={scale >= MAX_SCALE}
            >
              +
            </button>
            <button
              className="pdf-viewer__button pdf-viewer__button--ghost"
              onClick={handleZoomReset}
              disabled={Math.abs(scale - DEFAULT_SCALE) < 0.01}
            >
              重設
            </button>
          </div>
        </div>
      </div>

      {recentFiles.length > 0 && (
        <div className="pdf-viewer__recent">
          <span>最近開啟：</span>
          <ul className="pdf-viewer__recent-list">
            {recentFiles.map((entry) => {
              const canOpen = Boolean(entry.path && isTauriRuntime);
              return (
                <li key={`${entry.path ?? entry.label}-${entry.openedAt}`}>
                  <button
                    className="pdf-viewer__recent-button"
                    onClick={() => handleRecentOpen(entry)}
                    disabled={!canOpen}
                    title={
                      canOpen
                        ? `開啟 ${entry.label}`
                        : "僅限 Tauri 環境可重新開啟此檔案"
                    }
                  >
                    {entry.label}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="pdf-viewer__canvas-wrapper">
        {status === "ready" ? (
          <canvas ref={canvasRef} className="pdf-viewer__canvas" />
        ) : (
          <div className="pdf-viewer__placeholder">
            <p>請選擇一個 PDF 檔案開始閱讀。</p>
          </div>
        )}
      </div>
    </section>
  );
}
