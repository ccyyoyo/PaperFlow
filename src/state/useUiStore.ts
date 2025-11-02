/**
 * 檔案說明：
 * UI 狀態儲存（分頁切換）。
 */
import { create } from "zustand";

/**
 * 目前啟用中的分頁。
 */
export type ActiveTab = "viewer" | "notes" | "taxonomy";

/**
 * UI 狀態形狀。
 */
interface UiState {
  /** 目前啟用中的分頁 */
  activeTab: ActiveTab;
  /** 切換啟用分頁 */
  setActiveTab: (tab: ActiveTab) => void;
}

/**
 * useUiStore：提供 UI（分頁）相關的共享狀態。
 */
export const useUiStore = create<UiState>((set) => ({
  activeTab: "viewer",
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
