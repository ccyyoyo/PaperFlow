import { create } from 'zustand';

export type ViewerRequest = {
  paperId: string;
  page?: number;
};

type ViewerState = {
  request?: ViewerRequest;
  requestView: (target: ViewerRequest) => void;
  clearRequest: () => void;
};

export const useViewerStore = create<ViewerState>((set) => ({
  request: undefined,
  requestView: (target) => set({ request: target }),
  clearRequest: () => set({ request: undefined })
}));
