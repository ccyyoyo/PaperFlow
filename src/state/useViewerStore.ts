import { create } from "zustand";

export interface CurrentPdf {
  id: string;
  path: string | null;
  name: string;
  blobUrl: string;
  totalPages: number;
  lastOpenedAt: string;
}

interface ViewState {
  page: number;
  scale: number;
}

interface ViewerState {
  currentPdf: CurrentPdf | null;
  viewState: ViewState;
  setCurrentPdf: (pdf: CurrentPdf) => void;
  clearCurrentPdf: () => void;
  setViewState: (patch: Partial<ViewState>) => void;
}

export const DEFAULT_VIEW_STATE: ViewState = {
  page: 1,
  scale: 1.25,
};

export const useViewerStore = create<ViewerState>((set, get) => ({
  currentPdf: null,
  viewState: DEFAULT_VIEW_STATE,
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
}));
