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
  selectedNoteId: string | null;
  selectNote: (noteId: string | null) => void;
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
  selectedNoteId: null,
  loadNotes: async (paperId: string) => {
    if (!paperId) {
      set({ notes: [], selectedNoteId: null });
      return;
    }
    set({ isLoading: true, error: undefined });
    try {
      const notes = await NoteCommands.list(paperId);
      set((state) => ({
        notes,
        isLoading: false,
        selectedNoteId:
          state.selectedNoteId && notes.some((note) => note.id === state.selectedNoteId)
            ? state.selectedNoteId
            : null
      }));
    } catch (error) {
      set({ error: errorMessage(error), isLoading: false });
    }
  },
  upsertNote: (note) =>
    set((state) => {
      const filtered = state.notes.filter((existing) => existing.id !== note.id);
      return {
        notes: [...filtered, note],
        selectedNoteId: note.id
      };
    }),
  removeNote: (noteId) =>
    set((state) => ({
      notes: state.notes.filter((note) => note.id !== noteId),
      selectedNoteId: state.selectedNoteId === noteId ? null : state.selectedNoteId
    })),
  setNotes: (notes) =>
    set((state) => ({
      notes,
      selectedNoteId:
        state.selectedNoteId && notes.some((note) => note.id === state.selectedNoteId)
          ? state.selectedNoteId
          : null
    })),
  clearError: () => set({ error: undefined }),
  selectNote: (noteId) => set({ selectedNoteId: noteId ?? null })
}));
