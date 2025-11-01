import { create } from "zustand";

export type ActiveTab = "viewer" | "notes" | "taxonomy";

interface UiState {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
}

export const useUiStore = create<UiState>((set) => ({
  activeTab: "viewer",
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
