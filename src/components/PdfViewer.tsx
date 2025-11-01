import { useCallback, useEffect, useRef, useState } from "react";
import { open } from "@tauri-apps/api/dialog";
import { convertFileSrc } from "@tauri-apps/api/tauri";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import type {
  PDFDocumentProxy,
  PDFPageProxy,
} from "pdfjs-dist/types/src/display/api";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerSrc;

type PdfSource = {
  url: string;
  label: string;
  cleanup?: () => void;
};

const isTauriRuntime =
  typeof window !== "undefined" && Boolean((window as any).__TAURI_IPC__);

export function PdfViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [source, setSource] = useState<PdfSource | null>(null);

  const renderPage = useCallback(
    async (doc: PDFDocumentProxy, page: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const pdfPage: PDFPageProxy = await doc.getPage(page);
      const viewport = pdfPage.getViewport({ scale: 1.25 });

      const context = canvas.getContext("2d");
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await pdfPage.render({ canvasContext: context, viewport }).promise;
    },
    []
  );

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

        setPdfDocument(doc);
        setPageNumber(1);
        setPageCount(doc.numPages);
        setStatus("ready");
      } catch (error) {
        console.error("Failed to load PDF", error);
        setErrorMessage("無法載入 PDF，請再試一次或選擇其他檔案。");
        setPdfDocument(null);
        setPageNumber(1);
        setPageCount(0);
        setStatus("error");
      }
    },
    [source]
  );

  useEffect(() => {
    if (!pdfDocument || status !== "ready") return;
    renderPage(pdfDocument, pageNumber);
  }, [pdfDocument, pageNumber, renderPage, status]);

  useEffect(() => {
    return () => {
      if (source?.cleanup) {
        source.cleanup();
      }
    };
  }, [source]);

  const handlePickClick = async () => {
    if (isTauriRuntime) {
      const selected = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });

      if (typeof selected === "string") {
        const url = await convertFileSrc(selected);
        loadPdf({ url, label: selected });
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

  const handlePrevPage = () => {
    setPageNumber((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setPageNumber((prev) => Math.min(pageCount, prev + 1));
  };

  return (
    <section className="pdf-viewer">
      <div className="pdf-viewer__toolbar">
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
          {status === "error" && <span className="pdf-viewer__error">{errorMessage}</span>}
          {status === "idle" && <span>尚未選擇檔案</span>}
        </div>

        <div className="pdf-viewer__nav">
          <button
            className="pdf-viewer__button"
            onClick={handlePrevPage}
            disabled={pageNumber <= 1 || status !== "ready"}
          >
            上一頁
          </button>
          <button
            className="pdf-viewer__button"
            onClick={handleNextPage}
            disabled={pageNumber >= pageCount || status !== "ready"}
          >
            下一頁
          </button>
        </div>
      </div>

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
