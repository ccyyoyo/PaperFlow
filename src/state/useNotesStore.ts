import { create } from "zustand";
import type { NoteColor } from "../components/noteColors";

export type Note = {
  id: string;
  pdfId: string;
  page: number;
  content: string;
  color: NoteColor;
  tags: string[];
  updatedAt: string;
  anchor?: { x: number; y: number } | null;
};

type AddNoteInput = Omit<Note, "id" | "updatedAt"> & { id?: string };

interface NotesState {
  notesByPdf: Record<string, Note[]>;
  getNotes: (pdfId: string) => Note[];
  addNote: (input: AddNoteInput) => Note;
  setNotes: (pdfId: string, notes: Note[]) => void;
  upsertNote: (pdfId: string, note: Note) => void;
  updateNote: (
    pdfId: string,
    id: string,
    patch: Partial<Omit<Note, "id" | "pdfId">>
  ) => void;
  deleteNote: (pdfId: string, id: string) => void;
  clearAll: () => void;
}

function genId() {
  // Prefer crypto.randomUUID when available
  try {
    const g = (globalThis as any)?.crypto?.randomUUID?.() as string | undefined;
    if (g) return g;
  } catch {}
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  notesByPdf: {},
  getNotes: (pdfId) => {
    return get().notesByPdf[pdfId] ?? [];
  },
  addNote: (input) => {
    const id = input.id ?? genId();
    const nextNote: Note = {
      ...input,
      id,
      updatedAt: new Date().toISOString(),
    };
    set((state) => {
      const list = state.notesByPdf[input.pdfId] ?? [];
      return {
        notesByPdf: {
          ...state.notesByPdf,
          [input.pdfId]: [nextNote, ...list],
        },
      };
    });
    return nextNote;
  },
  setNotes: (pdfId, notes) => {
    set((state) => ({
      notesByPdf: { ...state.notesByPdf, [pdfId]: notes },
    }));
  },
  upsertNote: (pdfId, note) => {
    set((state) => {
      const list = state.notesByPdf[pdfId] ?? [];
      const idx = list.findIndex((n) => n.id === note.id);
      const next = idx >= 0 ? list.map((n, i) => (i === idx ? note : n)) : [note, ...list];
      return { notesByPdf: { ...state.notesByPdf, [pdfId]: next } };
    });
  },
  updateNote: (pdfId, id, patch) => {
    set((state) => {
      const list = state.notesByPdf[pdfId] ?? [];
      const next = list.map((n) =>
        n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n
      );
      return { notesByPdf: { ...state.notesByPdf, [pdfId]: next } };
    });
  },
  deleteNote: (pdfId, id) => {
    set((state) => {
      const list = state.notesByPdf[pdfId] ?? [];
      const next = list.filter((n) => n.id !== id);
      return { notesByPdf: { ...state.notesByPdf, [pdfId]: next } };
    });
  },
  clearAll: () => set({ notesByPdf: {} }),
}));
