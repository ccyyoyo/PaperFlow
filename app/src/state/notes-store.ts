import { create } from 'zustand';

import { Note } from '../types/note';
import { NoteCommands } from '../ipc/commands';

type NoteState = {
  notes: Note[];
  isLoading: boolean;
  error?: string;
  loadNotes: (paperId: string) => Promise<void>;
  upsertNote: (note: Note) => void;
  removeNote: (noteId: string) => void;
  setNotes: (notes: Note[]) => void;
  clearError: () => void;
};

function errorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: unknown }).message);
  }
  return 'Unable to load notes. Please try again.';
}

export const useNotesStore = create<NoteState>((set) => ({
  notes: [],
  isLoading: false,
  error: undefined,
  loadNotes: async (paperId: string) => {
    if (!paperId) {
      set({ notes: [] });
      return;
    }
    set({ isLoading: true, error: undefined });
    try {
      const notes = await NoteCommands.list(paperId);
      set({ notes, isLoading: false });
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false });
    }
  },
  upsertNote: (note) =>
    set((state) => {
      const filtered = state.notes.filter((existing) => existing.id !== note.id);
      return { notes: [...filtered, note] };
    }),
  removeNote: (noteId) =>
    set((state) => ({
      notes: state.notes.filter((note) => note.id !== noteId)
    })),
  setNotes: (notes) => set({ notes }),
  clearError: () => set({ error: undefined })
}));
