/**
 * 檔案說明：
 * PDF 檢視器相關的共享狀態（目前檔案、頁碼、縮放等）。
 */
import { create } from "zustand";

/**
 * 目前開啟的 PDF 概要資訊。
 */
export interface CurrentPdf {
  /** PDF 內部識別碼 */
  id: string;
  /** 原始檔案路徑（在瀏覽器環境可能為 null） */
  path: string | null;
  /** 顯示用檔名 */
  name: string;
  /** 供 <canvas> 渲染的 Blob URL */
  blobUrl: string;
  /** 總頁數 */
  totalPages: number;
  /** 最後開啟時間（ISO） */
  lastOpenedAt: string;
}

/**
 * 檢視狀態（頁碼與縮放）。
 */
interface ViewState {
  /** 當前頁碼（從 1 起算） */
  page: number;
  /** 當前縮放倍率 */
  scale: number;
}

/**
 * 檢視器共享狀態與操作。
 */
interface ViewerState {
  /** 目前開啟的 PDF */
  currentPdf: CurrentPdf | null;
  /** 檢視狀態（頁碼/縮放） */
  viewState: ViewState;
  /** 設定目前 PDF（切換時也會重置頁碼） */
  setCurrentPdf: (pdf: CurrentPdf) => void;
  /** 清除目前 PDF 並重置檢視狀態 */
  clearCurrentPdf: () => void;
  /** 局部更新檢視狀態 */
  setViewState: (patch: Partial<ViewState>) => void;
  // Jump/marker helpers
  /** 瞬間跳點的錨座標（用於視覺提示） */
  jumpAnchor: { x: number; y: number; token: number } | null;
  /** 觸發錨點提示 */
  flashJumpAnchor: (anchor: { x: number; y: number }) => void;
  /** 清除錨點提示 */
  clearJumpAnchor: () => void;
}

/** 預設檢視狀態。 */
export const DEFAULT_VIEW_STATE: ViewState = {
  page: 1,
  scale: 1.25,
};

/**
 * useViewerStore：封裝 PDF 檢視相關的共享狀態與操作。
 */
export const useViewerStore = create<ViewerState>((set, get) => ({
  currentPdf: null,
  viewState: DEFAULT_VIEW_STATE,
  jumpAnchor: null,
  setCurrentPdf: (pdf) => {
    const previous = get().currentPdf;
    const changed = previous?.blobUrl !== pdf.blobUrl;
    if (changed && previous?.blobUrl) {
      URL.revokeObjectURL(previous.blobUrl);
    }
    if (changed) {
      set({
        currentPdf: pdf,
        viewState: { ...get().viewState, page: 1 },
      });
    } else {
      set({ currentPdf: pdf });
    }
  },
  clearCurrentPdf: () => {
    const previous = get().currentPdf;
    if (previous?.blobUrl) {
      URL.revokeObjectURL(previous.blobUrl);
    }
    set({ currentPdf: null, viewState: DEFAULT_VIEW_STATE });
  },
  setViewState: (patch) => {
    set((state) => ({ viewState: { ...state.viewState, ...patch } }));
  },
  flashJumpAnchor: (anchor) => {
    const token = Date.now();
    set({ jumpAnchor: { ...anchor, token } });
  },
  clearJumpAnchor: () => set({ jumpAnchor: null }),
}));
