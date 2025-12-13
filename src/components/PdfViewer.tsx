/**
 * 檔案說明：
 * PDF 檢視器元件，負責載入 PDF、渲染頁面、追蹤最近開啟與最後頁面，
 * 並與筆記與分類狀態互動以建立、顯示與管理筆記。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { open } from "@tauri-apps/api/dialog";
import { invoke } from "@tauri-apps/api/tauri";
import { readBinaryFile } from "@tauri-apps/api/fs";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import type {
  PDFDocumentProxy,
  PDFPageProxy,
} from "pdfjs-dist/types/src/display/api";
import type { PageViewport } from "pdfjs-dist/types/src/display/display_utils";
import "pdfjs-dist/web/pdf_viewer.css";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { NOTE_COLOR_OPTIONS, NoteColor } from "./noteColors";
import { useViewerStore } from "../state/useViewerStore";
import { useNotesStore } from "../state/useNotesStore";
import { useTaxonomyStore } from "../state/useTaxonomyStore";

/** PDF 資源來源描述：可包含 URL、標籤與清理回呼。 */
type PdfSource = {
  url: string;
  label: string;
  originalPath?: string;
  cleanup?: () => void;
};

/** 最近開啟檔案的紀錄結構。 */
type RecentFile = {
  label: string;
  path: string | null;
  openedAt: number;
};

/** 編寫中的暫存筆記資料（頁碼、選取文字、錨點）。 */
type DraftNote = {
  page: number;
  selectedText: string;
  anchorYTopNorm: number | null;
};

// 是否在 Tauri 執行環境
const isTauriRuntime =
  typeof window !== "undefined" && Boolean((window as any).__TAURI_IPC__);
// 是否可使用瀏覽器本地儲存
const storageAvailable =
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

// 本地儲存鍵與縮放設定
const RECENT_FILES_KEY = "paperflow:recentFiles";
const LAST_PAGE_KEY = "paperflow:lastPageMap";
const MIN_SCALE = 0.5;
const MAX_SCALE = 3;
const SCALE_STEP = 0.25;
const DEFAULT_SCALE = 1.25;
const RECENT_LIMIT = 6;

// 指定 PDF.js 的 Web Worker 來源
GlobalWorkerOptions.workerSrc = workerSrc;

/** 由路徑抽取檔名。 */
function extractFileName(path: string) {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] ?? path;
}

/** 將數值限制於 [min, max] 範圍。 */
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** 正規化被選取的文字，移除零寬字元與多餘空白。 */
function normalizeSelectedText(input: string) {
  try {
    return input
      .replace(/\u00AD/g, "") // soft hyphen
      .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, "") // zero-widths
      .replace(/\u00A0/g, " ") // nbsp -> space
      .normalize("NFKC")
      .replace(/[\t\r\n]+/g, " ")
      .replace(/\s{2,}/g, " ")
      .trim();
  } catch {
    return input.trim();
  }
}

/** 自本地儲存讀取最近檔案清單。 */
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

/** 將最近檔案清單寫入本地儲存。 */
function persistRecentFiles(files: RecentFile[]) {
  if (!storageAvailable) return;
  try {
    window.localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(files));
  } catch (error) {
    console.warn("Unable to persist recent files", error);
  }
}

/** 讀取各檔案最後閱讀頁碼的對照表。 */
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

/** 寫入最後閱讀頁碼對照表至本地儲存。 */
function persistLastPageMap(map: Record<string, number>) {
  if (!storageAvailable) return;
  try {
    window.localStorage.setItem(LAST_PAGE_KEY, JSON.stringify(map));
  } catch (error) {
    console.warn("Unable to persist last page map", error);
  }
}

/** 取得來源識別鍵（優先使用原始路徑）。 */
function getSourceKey(ref: { originalPath?: string; label: string }) {
  return ref.originalPath ?? ref.label;
}

/**
 * 在 Tauri 環境中由檔案路徑建立 Blob URL，供 PDF.js 載入。
 */
async function createTauriPdfUrl(path: string) {
  const data = await readBinaryFile(path);
  const blob = new Blob([new Uint8Array(data)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  return { url, cleanup: () => URL.revokeObjectURL(url) };
}

/**
 * PdfViewer 元件：
 * - 載入與渲染 PDF 頁面
 * - 管理縮放、頁碼、最近檔案、最後頁面
 * - 與筆記/分類狀態互動以建立與檢視筆記
 */
export function PdfViewer() {
  // 畫布參考：用於渲染目前頁面的位圖
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  // 文字圖層容器：承載 PDF.js 產生的文字選取層
  const textLayerContainerRef = useRef<HTMLDivElement>(null);
  // 文字圖層建構器參考：維持 PDF.js textLayer builder 實例
  const textLayerBuilderRef = useRef<any | null>(null);
  // 目前頁面視窗資訊：包含尺寸與旋轉等
  const viewportRef = useRef<PageViewport | null>(null);
  // 隱藏檔案輸入框：在非 Tauri 環境選檔使用
  const inputRef = useRef<HTMLInputElement>(null);
  // 檢視器狀態：目前 PDF 與檢視狀態讀寫
  const { currentPdf, setCurrentPdf, setViewState, viewState } = useViewerStore();
  // 筆記狀態操作：新增筆記
  const addNote = useNotesStore((s) => s.addNote);
  // 筆記狀態操作：覆寫當前 PDF 的筆記清單
  const setNotes = useNotesStore((s) => s.setNotes);
  // 筆記狀態操作：新增或更新單筆筆記
  const upsertNoteInStore = useNotesStore((s) => s.upsertNote);
  // 分類（顏色）對照表
  const taxonomyColors = useTaxonomyStore((s) => s.colors);
  const colorOptions = useMemo(() => {
    const entries = Object.keys(taxonomyColors ?? {}).length
      ? taxonomyColors
      : Object.fromEntries(
          Object.entries(NOTE_COLOR_OPTIONS).map(([id, v]) => [id, { id, label: v.label, swatch: v.swatch }])
        );
    return entries as Record<string, { id: string; label: string; swatch: string }>;
  }, [taxonomyColors]);
  // 目前載入的 PDF 文件代理
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy | null>(null);
  // 內部頁碼狀態（同步至全域 viewState.page）
  const [pageNumberState, setPageNumberState] = useState(viewState.page ?? 1);
  // 總頁數
  const [pageCount, setPageCount] = useState(0);
  // 內部縮放狀態（同步至全域 viewState.scale）
  const [scaleState, setScaleState] = useState(viewState.scale ?? DEFAULT_SCALE);
  // 頁碼輸入框內容
  const [pageInput, setPageInput] = useState("1");
  // 最近開啟的檔案清單
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>(
    () => readRecentFiles()
  );
  // 各來源最後閱讀頁碼對照表
  const [lastPageMap, setLastPageMap] = useState<Record<string, number>>(
    () => readLastPageMap()
  );
  // 目前 PDF 來源（URL 與原始路徑等）
  const [source, setSource] = useState<PdfSource | null>(null);

  // 載入狀態與錯誤訊息
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 草稿卡片（由選取文字產生，尚未儲存）
  const [draftNote, setDraftNote] = useState<DraftNote | null>(null);
  // PDF 顯示模式：適合頁面（確保一頁完整可見）
  const [fitMode, setFitMode] = useState(true);
  // 來自檢視器的跳點錨座標與臨時標記
  const jumpAnchor = useViewerStore((s) => s.jumpAnchor);
  const [marker, setMarker] = useState<{ x: number; y: number } | null>(null);
  // Derived view values (keep above selectors that depend on them)
  // 導出目前頁碼（自本地 pageNumberState）
  const pageNumber = pageNumberState;
  // 導出目前縮放（自本地 scaleState）
  const scale = scaleState;
  const notesForPdf = useNotesStore((s) =>
    currentPdf ? s.getNotes(currentPdf.id) : []
  );
  // 筆記可見範圍（單頁/全部）
  const [notesScope, setNotesScope] = useState<"page" | "all">("page");
  const [freePinnedPage, setFreePinnedPage] = useState<number | null>(null);
  // 卡片側欄模式（分開瀏覽 / 對齊跟隨）
  const [cardSidebarMode, setCardSidebarMode] = useState<"free" | "align">("free");
  const notesBodyRef = useRef<HTMLDivElement>(null);
  const [pageHeightPx, setPageHeightPx] = useState<number>(0);
  const freeScrollTopRef = useRef<number>(0);
  const visibleNotes = useMemo(() => {
    const list = notesForPdf;
    if (notesScope === "all") return list;

    const targetPage =
      cardSidebarMode === "free" ? freePinnedPage ?? pageNumber : pageNumber;
    return list.filter((n) => n.page === targetPage);
  }, [notesForPdf, notesScope, pageNumber, cardSidebarMode, freePinnedPage]);

  // Quick edit state for sidebar notes
  // 側邊欄快速編輯狀態
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editColor, setEditColor] = useState<string>("idea");
  const [editTags, setEditTags] = useState<string[]>([]);
  const [editTagInput, setEditTagInput] = useState("");

  // 開始編輯指定筆記
  const beginEdit = (n: any) => {
    if (draftNote && editingId === "__draft" && n?.id !== "__draft") {
      if (!window.confirm("你有一張未儲存的卡片，確定要放棄嗎？")) return;
      setDraftNote(null);
      setEditingId(null);
    }
    setEditingId(n.id);
    setEditContent(n.content ?? "");
    setEditColor(n.color ?? "idea");
    setEditTags(Array.isArray(n.tags) ? n.tags : []);
    setEditTagInput("");
  };
  // 取消編輯並重置快速編輯狀態
  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
    setEditColor("idea");
    setEditTags([]);
    setEditTagInput("");
  };

  const cancelDraftCard = () => {
    setDraftNote(null);
    setEditingId(null);
    setEditContent("");
    setEditColor("idea");
    setEditTags([]);
    setEditTagInput("");
  };

  // 更新頁碼，並同步至全域檢視狀態
  const updatePageNumber = useCallback(
    (value: number) => {
      setPageNumberState(value);
      setViewState({ page: value });
    },
    [setViewState]
  );

  // 更新縮放倍率，並同步至全域檢視狀態
  const updateScale = useCallback(
    (value: number) => {
      setScaleState(value);
      setViewState({ scale: value });
    },
    [setViewState]
  );

  // 以當前文件、頁碼與倍率渲染頁面與文字圖層
  const renderPage = useCallback(
    async (doc: PDFDocumentProxy, page: number, pageScale: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const pdfPage: PDFPageProxy = await doc.getPage(page);
      const safeScale = Math.max(MIN_SCALE, Math.abs(pageScale || DEFAULT_SCALE));
      const rotation = (pdfPage as any)?.rotate ?? 0; // keep the page's inherent rotation
      const viewport = pdfPage.getViewport({ scale: safeScale, rotation, dontFlip: false as any });
      viewportRef.current = viewport;
      setPageHeightPx(viewport.height);

      const context = canvas.getContext("2d");
      if (!context) return;

      // Ensure no residual transforms from previous renders
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      // Ensure no CSS transforms are applied
      (canvas as HTMLCanvasElement).style.transform = "none";

      await pdfPage.render({ canvasContext: context, viewport }).promise;

      const container = textLayerContainerRef.current;
      if (container) {
        if (!textLayerBuilderRef.current) {
          const viewerModule = (await import(
            "pdfjs-dist/web/pdf_viewer.mjs"
          )) as any;
          const TextLayerBuilderClass =
            viewerModule?.TextLayerBuilder ?? viewerModule?.default?.TextLayerBuilder;

          if (!TextLayerBuilderClass) {
            console.warn("pdfjs TextLayerBuilder not available");
            container.innerHTML = "";
            return;
          }

          textLayerBuilderRef.current = new TextLayerBuilderClass({ pdfPage });
        } else if (typeof textLayerBuilderRef.current?.cancel === "function") {
          textLayerBuilderRef.current.cancel();
        }

        const builder = textLayerBuilderRef.current;
        container.innerHTML = "";
        builder.div.style.position = "absolute";
        builder.div.style.inset = "0";
        builder.div.style.pointerEvents = "auto";
        builder.div.style.color = "transparent";

        await builder.render(viewport);
        container.append(builder.div);
      }
    },
    []
  );

  const fitCurrentPage = useCallback(async () => {
    if (!pdfDocument || status !== "ready") return;
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;

    const style = window.getComputedStyle(wrapper);
    const paddingX =
      Number.parseFloat(style.paddingLeft || "0") + Number.parseFloat(style.paddingRight || "0");
    const paddingY =
      Number.parseFloat(style.paddingTop || "0") + Number.parseFloat(style.paddingBottom || "0");

    const availableWidth = Math.max(1, wrapper.clientWidth - paddingX);
    const availableHeight = Math.max(1, wrapper.clientHeight - paddingY);

    try {
      const pdfPage: PDFPageProxy = await pdfDocument.getPage(pageNumber);
      const rotation = (pdfPage as any)?.rotate ?? 0;
      const baseViewport = pdfPage.getViewport({ scale: 1, rotation, dontFlip: false as any });
      const nextScale = clamp(
        Math.min(availableWidth / baseViewport.width, availableHeight / baseViewport.height),
        MIN_SCALE,
        MAX_SCALE
      );
      updateScale(Number(nextScale.toFixed(2)));
    } catch (e) {
      console.warn("Failed to fit page", e);
    }
  }, [pageNumber, pdfDocument, status, updateScale]);

  useEffect(() => {
    if (!fitMode) return;
    fitCurrentPage();
  }, [fitMode, fitCurrentPage, pageNumber, status]);

  useEffect(() => {
    if (!fitMode) return;
    const onResize = () => fitCurrentPage();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitMode, fitCurrentPage]);

  // Flash a marker when a jump anchor request is emitted
  // 當收到跳點請求時，短暫顯示視覺標記
  useEffect(() => {
    if (!jumpAnchor) return;
    setMarker({ x: jumpAnchor.x, y: jumpAnchor.y });
    const t = setTimeout(() => setMarker(null), 1600);
    return () => clearTimeout(t);
  }, [jumpAnchor?.token]);

  // 分開 / 對齊：保留分開模式的捲動位置，切到對齊時回到目前頁卡片並開始跟隨。
  useEffect(() => {
    const body = notesBodyRef.current;
    if (!body) return;

    if (cardSidebarMode === "align") {
      freeScrollTopRef.current = body.scrollTop;
      setNotesScope("page");
      body.scrollTop = 0;
      return;
    }

    body.scrollTop = freeScrollTopRef.current;
  }, [cardSidebarMode]);

  useEffect(() => {
    if (cardSidebarMode !== "align") return;
    if (notesBodyRef.current) notesBodyRef.current.scrollTop = 0;
  }, [cardSidebarMode, pageNumber]);

  // 更新最近檔案清單：去重後前置並裁切至上限
  const updateRecentFiles = useCallback((entry: RecentFile) => {
    setRecentFiles((previous) => {
      // 過濾相同來源項目（以 path 優先，否則以 label 判斷）
      const filtered = previous.filter((item) =>
        entry.path
          ? item.path !== entry.path
          : item.label !== entry.label || Boolean(item.path)
      );
      // 新清單置頂新增項目並限制數量
      const next = [entry, ...filtered].slice(0, RECENT_LIMIT);
      persistRecentFiles(next);
      return next;
    });
  }, []);

  // 載入 PDF：支援保留視圖、更新最近清單與同步全域狀態
  const loadPdf = useCallback(
    async (
      pdfSource: PdfSource,
      options?: { preserveView?: boolean; touchRecent?: boolean; updateStore?: boolean }
    ) => {
      // 是否保留現有頁碼與縮放
      const preserveView = Boolean(options?.preserveView);
      // 是否更新最近檔案清單（預設 true）
      const touchRecent = options?.touchRecent !== false; // default true
      // 是否同步到共享 Store（預設 true）
      const updateStore = options?.updateStore !== false; // default true
      // Avoid revoking the same blob URL when rehydrating with the same source
      if (source?.cleanup && source.url !== pdfSource.url) {
        source.cleanup();
      }

      setStatus("loading");
      setErrorMessage(null);
      setSource(pdfSource);

      try {
        const task = getDocument({ url: pdfSource.url });
        const doc = await task.promise;

        const key = getSourceKey(pdfSource);
        const savedPage = lastPageMap[key];
        const initialPage = savedPage ? clamp(savedPage, 1, doc.numPages) : 1;

        setPdfDocument(doc);
        setPageCount(doc.numPages);
        if (!preserveView) {
          updateScale(DEFAULT_SCALE);
          updatePageNumber(initialPage);
          setPageInput(initialPage.toString());
        } else {
          // keep existing view settings (page/scale) from store/local state
          setPageInput((viewState.page ?? 1).toString());
        }
        setStatus("ready");

        setDraftNote(null);
        setEditingId(null);
        setEditContent("");
        setEditColor("idea");
        setEditTags([]);
        setEditTagInput("");
        setCardSidebarMode("free");

        if (touchRecent) {
          updateRecentFiles({
            label: pdfSource.label,
            path: pdfSource.originalPath ?? null,
            openedAt: Date.now(),
          });
        }

        let resolvedPdfId = key; // default: path or label
        // If running in Tauri and we have a file path, ensure paper exists and use its id
        if (updateStore && isTauriRuntime && pdfSource.originalPath) {
          try {
            const paper = await invoke<any>("upsert_paper_command", {
              title: pdfSource.label,
              path: pdfSource.originalPath,
            });
            if (paper?.id) {
              resolvedPdfId = String(paper.id);
              // Load notes for this paper from backend
              const backendNotes = await invoke<any>("list_notes_command", {
                paperId: resolvedPdfId,
              });
              if (Array.isArray(backendNotes)) {
                const mapped = backendNotes.map((n: any) => ({
                  id: String(n.id),
                  pdfId: String(n.paperId ?? resolvedPdfId),
                  page: Number(n.page ?? 1),
                  quote: n.quote != null ? String(n.quote) : null,
                  content: String(n.content ?? ""),
                  color: (n.color ?? "idea") as NoteColor,
                  tags: String(n.tags ?? "")
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean),
                  updatedAt: String(n.updatedAt ?? new Date().toISOString()),
                  anchorYTopNorm:
                    n.anchorYTopNorm != null ? Number(n.anchorYTopNorm) : null,
                }));
                setNotes(resolvedPdfId, mapped);
              }
            }
          } catch (e) {
            console.warn("Unable to upsert paper or list notes", e);
          }
        }

        if (updateStore) {
          setCurrentPdf({
            id: resolvedPdfId,
            path: pdfSource.originalPath ?? null,
            name: pdfSource.label,
            blobUrl: pdfSource.url,
            totalPages: doc.numPages,
            lastOpenedAt: new Date().toISOString(),
          });
        }
      } catch (error) {
        console.error("Failed to load PDF", error);
        setErrorMessage("無法載入 PDF，請再試一次或選擇其他檔案。");
        setPdfDocument(null);
        updatePageNumber(1);
        setPageCount(0);
        setStatus("error");
      }
    },
    [lastPageMap, source, updateRecentFiles]
  );

  // 初次掛載或切換回檢視器時，若已有 currentPdf，嘗試復原顯示
  useEffect(() => {
    if (!pdfDocument || status !== "ready") return;
    renderPage(pdfDocument, pageNumber, scale);
  }, [pdfDocument, pageNumber, renderPage, scale, status]);

  // When the viewer mounts (e.g., after tab switch), if there's already a currentPdf
  // in the shared store, reload it without resetting view (page/scale) or recent list.
  useEffect(() => {
    if (!pdfDocument && currentPdf && status === "idle") {
      loadPdf(
        {
          url: currentPdf.blobUrl,
          label: currentPdf.name,
          originalPath: currentPdf.path ?? undefined,
        },
        { preserveView: true, touchRecent: false }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPdf]);

  // 同步頁碼到輸入框字串
  useEffect(() => {
    setPageInput(pageNumber.toString());
  }, [pageNumber]);

  // 在狀態就緒時記錄最後閱讀頁碼
  useEffect(() => {
    if (!source || status !== "ready") return;
    // 每個來源的鍵（原始路徑優先）
    const key = getSourceKey(source);
    setLastPageMap((prev) => {
      const next = { ...prev, [key]: pageNumber };
      persistLastPageMap(next);
      return next;
    });
  }, [pageNumber, source, status]);

  // Esc：取消目前編輯（草稿/既有卡片）
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (editingId === "__draft") {
        cancelDraftCard();
        return;
      }
      if (editingId) {
        cancelEdit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editingId]);

  // 點擊「開啟檔案」：在 Tauri 以原生選單選擇，否則觸發隱藏 input
  const handlePickClick = async () => {
    if (isTauriRuntime) {
      // 以原生對話框選擇 PDF 檔
      const selected = await open({
        multiple: false,
        filters: [{ name: "PDF", extensions: ["pdf"] }],
      });

      if (typeof selected === "string") {
        // 抽取顯示用檔名並建立 Blob URL
        const label = extractFileName(selected);
        const { url, cleanup } = await createTauriPdfUrl(selected);
        loadPdf({ url, label, originalPath: selected, cleanup });
      }

      return;
    }

    inputRef.current?.click();
  };

  // 處理瀏覽器檔案輸入（非 Tauri）
  const handleFileInput = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    // 取得使用者選取的第一個檔案
    const file = event.target.files?.[0];
    if (!file) return;

    // 建立臨時 Blob URL 供 PDF.js 載入
    const url = URL.createObjectURL(file);

    loadPdf({
      url,
      label: file.name,
      cleanup: () => URL.revokeObjectURL(url),
    });
  };

  const handleRecentOpen = async (entry: RecentFile) => {
    if (!entry.path || !isTauriRuntime) return;
    const { url, cleanup } = await createTauriPdfUrl(entry.path);
    loadPdf({ url, label: entry.label, originalPath: entry.path, cleanup });
  };

  const handlePrevPage = () => {
    updatePageNumber(Math.max(1, pageNumber - 1));
  };

  const handleNextPage = () => {
    updatePageNumber(Math.min(pageCount, pageNumber + 1));
  };

  const handlePageSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status !== "ready") return;
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isNaN(parsed)) return;
    updatePageNumber(clamp(parsed, 1, pageCount));
  };

  const handleZoomIn = () => {
    setFitMode(false);
    const next = Math.min(MAX_SCALE, Number((scale + SCALE_STEP).toFixed(2)));
    updateScale(next);
  };

  const handleZoomOut = () => {
    setFitMode(false);
    const next = Math.max(MIN_SCALE, Number((scale - SCALE_STEP).toFixed(2)));
    updateScale(next);
  };

  const handleZoomReset = () => {
    setFitMode(false);
    updateScale(DEFAULT_SCALE);
  };

  // Keyboard shortcuts: ArrowLeft / ArrowRight to navigate pages
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (status !== "ready") return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable =
        (target && (target as any).isContentEditable) ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT";
      if (isEditable) return;

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        handlePrevPage();
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        handleNextPage();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [status, handlePrevPage, handleNextPage]);

  const handleTextSelection = useCallback(() => {
    const textLayerRoot = textLayerBuilderRef.current?.div;
    if (!textLayerRoot) return;

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const anchorNode = selection.anchorNode;
    const focusNode = selection.focusNode;
    if (
      (anchorNode && !textLayerRoot.contains(anchorNode)) ||
      (focusNode && !textLayerRoot.contains(focusNode))
    ) {
      return;
    }

    const text = normalizeSelectedText(selection.toString());
    if (!text) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const canvasRect = canvasRef.current?.getBoundingClientRect();
    let anchorYTopNorm: number | null = null;
    if (canvasRect) {
      const topY = (rect.top - canvasRect.top) / canvasRect.height;
      anchorYTopNorm = Number(clamp(topY, 0, 1).toFixed(4));
    }

    const snippet = text.length > 200 ? `${text.slice(0, 200)}…` : text;

    setDraftNote({
      page: pageNumber,
      selectedText: snippet,
      anchorYTopNorm,
    });
    setEditContent(snippet);
    setEditColor("idea");
    setEditTags([]);
    setEditTagInput("");
    setEditingId("__draft");
    setCardSidebarMode("align");
    setNotesScope("page");

    setTimeout(() => selection.removeAllRanges(), 0);
  }, [pageNumber]);

  const saveDraftCard = async () => {
    const trimmed = editContent.trim();
    if (!trimmed) {
      try {
        const { useToast } = await import("../state/useToast");
        useToast.getState().show("error", "內容不可為空白");
      } catch {}
      return;
    }

    if (!currentPdf || !draftNote) {
      try {
        const { useToast } = await import("../state/useToast");
        useToast.getState().show("info", "請先選擇並載入一份 PDF");
      } catch {}
      return;
    }

    const anchorYTopNorm = draftNote.anchorYTopNorm ?? null;
    const pageForNote = draftNote.page ?? pageNumber;

    if (isTauriRuntime && currentPdf.path) {
      try {
        const created = await invoke<any>("create_note_command", {
          input: {
            paperId: currentPdf.id,
            page: pageForNote,
            anchorYTopNorm,
            quote: draftNote.selectedText ?? null,
            content: trimmed,
            color: editColor,
            tags: editTags.join(","),
          },
        });
        const mapped = {
          id: String(created.id),
          pdfId: currentPdf.id,
          page: Number(created.page ?? pageForNote),
          quote: created.quote != null ? String(created.quote) : draftNote.selectedText ?? null,
          content: String(created.content ?? trimmed),
          color: (created.color ?? editColor) as NoteColor,
          tags: String(created.tags ?? editTags.join(","))
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          updatedAt: String(created.updatedAt ?? new Date().toISOString()),
          anchorYTopNorm:
            created.anchorYTopNorm != null
              ? Number(created.anchorYTopNorm)
              : anchorYTopNorm,
        };
        upsertNoteInStore(currentPdf.id, mapped);
        try {
          const { useToast } = await import("../state/useToast");
          useToast.getState().show("success", "卡片已儲存");
        } catch {}
        cancelDraftCard();
        return;
      } catch (e) {
        console.warn("Failed to create note via backend; falling back to memory", e);
        try {
          const { useToast } = await import("../state/useToast");
          useToast.getState().show("info", "後端儲存失敗，已暫存於本機");
        } catch {}
      }
    }

    // Fallback: local only
    addNote({
      pdfId: currentPdf.id,
      page: pageForNote,
      quote: draftNote.selectedText ?? null,
      content: trimmed,
      color: editColor as any,
      tags: editTags,
      anchorYTopNorm,
    });
    try {
      const { useToast } = await import("../state/useToast");
      useToast.getState().show("success", "卡片已暫存於本機");
    } catch {}
    cancelDraftCard();
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
            <button
              className={`pdf-viewer__button pdf-viewer__button--ghost ${fitMode ? "pdf-viewer__button--active" : ""}`}
              onClick={() => {
                setFitMode(true);
                fitCurrentPage();
              }}
              disabled={status !== "ready"}
              type="button"
              title="自動調整縮放，確保完整顯示一頁"
            >
              適合頁面
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
                        : "僅限桌面環境可重新開啟此檔案"
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

      <div className="pdf-viewer__body">
        <div className="pdf-viewer__document">
          <div ref={canvasWrapperRef} className="pdf-viewer__canvas-wrapper">
            {status === "loading" ? (
              <div className="pdf-viewer__skeleton">
                <div className="skeleton pdf-viewer__skeleton-page" />
              </div>
            ) : status === "ready" ? (
              <div className="pdf-viewer__page">
                <canvas ref={canvasRef} className="pdf-viewer__canvas" />
                <div
                  ref={textLayerContainerRef}
                  className="pdf-viewer__text-layer"
                  onMouseUp={handleTextSelection}
                  onTouchEnd={handleTextSelection}
                  role="presentation"
                />
                {marker && (
                  <div
                    className="pdf-viewer__jump-marker"
                    style={{
                      left: `${(marker.x || 0) * (canvasRef.current?.width || 0)}px`,
                      top: `${(marker.y || 0) * (canvasRef.current?.height || 0)}px`,
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="pdf-viewer__placeholder">
                <p>請選擇一個 PDF 檔案開始閱讀。</p>
              </div>
            )}
          </div>
        </div>
        <aside className="pdf-viewer__notes">
          <header className="pdf-viewer__notes-header">
            <h3>卡片</h3>
            <div className="pdf-viewer__notes-controls">
              <button
                type="button"
                className={`pdf-viewer__button pdf-viewer__button--ghost ${cardSidebarMode === "free" ? "pdf-viewer__button--active" : ""}`}
                onClick={() => {
                  setCardSidebarMode("free");
                  setNotesScope("all");
                }}
              >
                分開
              </button>
              <button
                type="button"
                className={`pdf-viewer__button pdf-viewer__button--ghost ${cardSidebarMode === "align" ? "pdf-viewer__button--active" : ""}`}
                onClick={() => setCardSidebarMode("align")}
                disabled={!currentPdf}
                title={!currentPdf ? "請先載入 PDF" : "回到目前頁面的卡片並開始跟隨"}
              >
                對齊
              </button>
            </div>
          </header>
          {cardSidebarMode === "free" && (
            <div className="pdf-viewer__notes-subcontrols">
              <button
                type="button"
                className={`pdf-viewer__button pdf-viewer__button--ghost ${notesScope === "page" ? "pdf-viewer__button--active" : ""}`}
                onClick={() => {
                  setFreePinnedPage(pageNumber);
                  setNotesScope("page");
                }}
                disabled={!currentPdf}
              >
                固定頁
              </button>
              <button
                type="button"
                className={`pdf-viewer__button pdf-viewer__button--ghost ${notesScope === "all" ? "pdf-viewer__button--active" : ""}`}
                onClick={() => setNotesScope("all")}
                disabled={!currentPdf}
              >
                全部
              </button>
            </div>
          )}
          <div
            ref={notesBodyRef}
            className="pdf-viewer__notes-body"
            onScroll={() => {
              if (cardSidebarMode === "free" && notesBodyRef.current) {
                freeScrollTopRef.current = notesBodyRef.current.scrollTop;
              }
            }}
          >
            {(() => {
              if (!currentPdf) {
                return <p className="pdf-viewer__notes-empty">載入 PDF 後即可顯示卡片。</p>;
              }

              const draftCard =
                draftNote && editingId === "__draft"
                  ? ({
                      id: "__draft",
                      pdfId: currentPdf.id,
                      page: draftNote.page,
                      quote: draftNote.selectedText ?? null,
                      content: editContent || draftNote.selectedText,
                      color: (editColor || "idea") as any,
                      tags: editTags,
                      updatedAt: new Date().toISOString(),
                      anchorYTopNorm: draftNote.anchorYTopNorm ?? null,
                    } as any)
                  : null;

              const baseNotes =
                cardSidebarMode === "align"
                  ? notesForPdf.filter((n) => n.page === pageNumber)
                  : visibleNotes;

              const sidebarNotes = draftCard ? [draftCard, ...baseNotes] : baseNotes;

              const renderCard = (n: any) => {
                const swatch = (colorOptions?.[n.color]?.swatch as string) || "#6b7280";
                const isDraft = n.id === "__draft";
                const isEditing = editingId === n.id;

                return (
                  <>
                    <button
                      type="button"
                      className="pdf-viewer__note-card-main"
                      style={{ ["--note-swatch" as any]: swatch } as any}
                      onClick={() => {
                        updatePageNumber(n.page);
                        if (n.anchorYTopNorm != null) {
                          setMarker({ x: 0.5, y: Number(n.anchorYTopNorm) });
                          setTimeout(() => setMarker(null), 1600);
                        }
                      }}
                      title={`跳至第 ${n.page} 頁`}
                    >
                      <span className="pdf-viewer__note-row-swatch" />
                      <span className="pdf-viewer__note-row-main">
                        <span className="pdf-viewer__note-row-title">
                          {isDraft ? "新卡片" : `第 ${n.page} 頁`}
                        </span>
                        <span className="pdf-viewer__note-row-content">{n.content}</span>
                        {n.tags.length > 0 && (
                          <span className="pdf-viewer__note-row-tags">
                            {n.tags.map((t: string) => (
                              <em key={t}>#{t}</em>
                            ))}
                          </span>
                        )}
                      </span>
                    </button>

                    <div className="pdf-viewer__note-row-actions">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            className="pdf-viewer__button pdf-viewer__button--ghost"
                            onClick={async () => {
                              if (!currentPdf) return;
                              if (isDraft) {
                                await saveDraftCard();
                                return;
                              }
                              try {
                                if (isTauriRuntime && currentPdf.path) {
                                  const updated = await invoke<any>("update_note_command", {
                                    payload: {
                                      id: n.id,
                                      content: editContent,
                                      color: editColor,
                                      tags: editTags.join(","),
                                    },
                                  });
                                  const mapped = {
                                    id: String(updated.id ?? n.id),
                                    pdfId: currentPdf.id,
                                    page: Number(updated.page ?? n.page),
                                    quote: updated.quote != null ? String(updated.quote) : n.quote ?? null,
                                    content: String(updated.content ?? editContent),
                                    color: (updated.color ?? editColor) as NoteColor,
                                    tags: String(updated.tags ?? editTags.join(","))
                                      .split(",")
                                      .map((t: string) => t.trim())
                                      .filter(Boolean),
                                    updatedAt: String(updated.updatedAt ?? new Date().toISOString()),
                                    anchorYTopNorm:
                                      updated.anchorYTopNorm != null
                                        ? Number(updated.anchorYTopNorm)
                                        : n.anchorYTopNorm ?? null,
                                  } as any;
                                  upsertNoteInStore(currentPdf.id, mapped);
                                } else {
                                  upsertNoteInStore(currentPdf.id, {
                                    ...n,
                                    content: editContent,
                                    color: editColor as any,
                                    tags: editTags,
                                    updatedAt: new Date().toISOString(),
                                  } as any);
                                }
                                try {
                                  const { useToast } = await import("../state/useToast");
                                  useToast.getState().show("success", "卡片已更新");
                                } catch {}
                              } finally {
                                cancelEdit();
                              }
                            }}
                          >
                            儲存
                          </button>
                          <button
                            type="button"
                            className="pdf-viewer__button pdf-viewer__button--ghost"
                            onClick={() => {
                              if (isDraft) {
                                cancelDraftCard();
                                return;
                              }
                              cancelEdit();
                            }}
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <>
                          {!isDraft && (
                            <button
                              type="button"
                              className="pdf-viewer__button pdf-viewer__button--ghost"
                              onClick={() => beginEdit(n)}
                            >
                              編輯
                            </button>
                          )}
                          {isDraft ? (
                            <button
                              type="button"
                              className="pdf-viewer__button pdf-viewer__button--ghost"
                              onClick={cancelDraftCard}
                            >
                              放棄
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="pdf-viewer__button pdf-viewer__button--ghost"
                              onClick={async () => {
                                if (!currentPdf) return;
                                if (!window.confirm("確定刪除此卡片？")) return;
                                if (isTauriRuntime && currentPdf.path) {
                                  try {
                                    await invoke("delete_note_command", { noteId: n.id });
                                  } catch (e) {
                                    const { useToast } = await import("../state/useToast");
                                    useToast.getState().show("error", "刪除失敗");
                                    return;
                                  }
                                }
                                useNotesStore.getState().deleteNote(currentPdf.id, n.id);
                                try {
                                  const { useToast } = await import("../state/useToast");
                                  useToast.getState().show("success", "卡片已刪除");
                                } catch {}
                              }}
                            >
                              刪除
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    {isEditing && (
                      <div className="pdf-viewer__note-edit">
                        <textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          rows={3}
                          placeholder="更新內容"
                        />
                        <div className="pdf-viewer__note-color-options">
                          {Object.keys(colorOptions).map((key) => {
                            const option = colorOptions[key];
                            const isActive = editColor === key;
                            return (
                              <button
                                key={key}
                                type="button"
                                className={`pdf-viewer__note-color ${isActive ? "pdf-viewer__note-color--active" : ""}`}
                                onClick={() => setEditColor(key)}
                              >
                                <span
                                  className="pdf-viewer__note-color-swatch"
                                  style={{ background: option.swatch }}
                                />
                                {option.label}
                              </button>
                            );
                          })}
                        </div>
                        <div className="pdf-viewer__note-tags-input">
                          {editTags.map((tag: string) => (
                            <span key={tag} className="pdf-viewer__note-tag">
                              {tag}
                              <button
                                type="button"
                                className="pdf-viewer__note-tag-remove"
                                onClick={() => setEditTags(editTags.filter((t) => t !== tag))}
                                aria-label={`移除標籤 ${tag}`}
                              >
                                ×
                              </button>
                            </span>
                          ))}
                          <input
                            value={editTagInput}
                            onChange={(e) => setEditTagInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === ",") {
                                e.preventDefault();
                                const v = editTagInput.trim();
                                if (v && !editTags.includes(v)) setEditTags([...editTags, v]);
                                setEditTagInput("");
                              } else if (e.key === "Backspace" && editTagInput === "") {
                                setEditTags((prev) => prev.slice(0, -1));
                              }
                            }}
                            placeholder={editTags.length === 0 ? "輸入後按 Enter" : "新增標籤"}
                          />
                        </div>
                      </div>
                    )}
                  </>
                );
              };

              if (cardSidebarMode === "align") {
                if (sidebarNotes.length === 0) {
                  return <p className="pdf-viewer__notes-empty">本頁尚無卡片。</p>;
                }

                const trackHeight = Math.max(pageHeightPx || 0, 520);
                const minCardHeight = 150;
                const gap = 12;
                let cursorBottom = 0;

                const sorted = [...sidebarNotes].sort(
                  (a: any, b: any) => (a.anchorYTopNorm ?? 0) - (b.anchorYTopNorm ?? 0)
                );

                return (
                  <div className="pdf-viewer__aligned-track" style={{ height: `${trackHeight}px` }}>
                    {sorted.map((n: any) => {
                      const rawTop = clamp(Number(n.anchorYTopNorm ?? 0), 0, 1) * trackHeight;
                      const top = Math.max(rawTop, cursorBottom ? cursorBottom + gap : 0);
                      cursorBottom = top + minCardHeight;
                      return (
                        <div
                          key={n.id}
                          className="pdf-viewer__note-card pdf-viewer__note-card--aligned"
                          style={{ top: `${top}px` }}
                        >
                          {renderCard(n)}
                        </div>
                      );
                    })}
                  </div>
                );
              }

              return (
                <>
                  {sidebarNotes.length === 0 && (
                    <p className="pdf-viewer__notes-empty">
                      {notesScope === "page" ? "固定頁尚無卡片。" : "尚無卡片。"}
                    </p>
                  )}
                  <ul className="pdf-viewer__cards-list">
                    {sidebarNotes.map((n: any) => (
                      <li key={n.id} className="pdf-viewer__note-card">
                        {renderCard(n)}
                      </li>
                    ))}
                  </ul>
                </>
              );
            })()}
          </div>
        </aside>

      </div>
    </section>
  );
}
