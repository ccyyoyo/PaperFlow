/**
 * 檔案說明：
 * 筆記資料與操作的共享狀態（建立、讀取、更新、刪除、合併等）。
 */
import { create } from "zustand";
import type { NoteColor } from "../components/noteColors";

/**
 * 筆記實體。
 */
export type Note = {
  /** 唯一識別 */
  id: string;
  /** 隸屬 PDF 的識別 */
  pdfId: string;
  /** 所在頁碼（從 1 起算） */
  page: number;
  /** 文字內容 */
  content: string;
  /** 指派顏色分類 */
  color: NoteColor;
  /** 關聯標籤 */
  tags: string[];
  /** 最後更新時間（ISO） */
  updatedAt: string;
  /** 於頁面上的錨點座標（可為 null） */
  anchor?: { x: number; y: number } | null;
};

/** 新增筆記的輸入（id 可選、updatedAt 由系統填寫）。 */
type AddNoteInput = Omit<Note, "id" | "updatedAt"> & { id?: string };

/**
 * 筆記狀態與操作介面。
 */
interface NotesState {
  /** 以 PDF id 為 key 的筆記列表對照 */
  notesByPdf: Record<string, Note[]>;
  /** 取得單一 PDF 的筆記清單 */
  getNotes: (pdfId: string) => Note[];
  /** 新增一則筆記並回傳 */
  addNote: (input: AddNoteInput) => Note;
  /** 覆寫指定 PDF 的筆記清單 */
  setNotes: (pdfId: string, notes: Note[]) => void;
  /** 新增或更新指定筆記 */
  upsertNote: (pdfId: string, note: Note) => void;
  /** 局部更新指定筆記 */
  updateNote: (
    pdfId: string,
    id: string,
    patch: Partial<Omit<Note, "id" | "pdfId">>
  ) => void;
  /** 刪除指定筆記 */
  deleteNote: (pdfId: string, id: string) => void;
  /** 清空所有筆記 */
  clearAll: () => void;
}

/** 產生唯一識別字串（優先使用 crypto.randomUUID）。 */
function genId() {
  // Prefer crypto.randomUUID when available
  try {
    const g = (globalThis as any)?.crypto?.randomUUID?.() as string | undefined;
    if (g) return g;
  } catch {}
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * useNotesStore：封裝筆記 CRUD 與本地狀態管理。
 */
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
