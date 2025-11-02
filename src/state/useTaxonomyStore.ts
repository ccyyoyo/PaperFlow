/**
 * 檔案說明：
 * 顏色分類與文字標籤的共享狀態，含本地儲存持久化。
 */
import { create } from "zustand";

/**
 * 顏色分類項目。
 */
export type ColorCategory = {
  /** 分類 id（slug） */
  id: string;
  /** 顯示名稱 */
  label: string;
  /** HEX 色碼 */
  swatch: string;
};

/**
 * 分類與標籤的狀態與操作介面。
 */
type TaxonomyState = {
  /** 顏色分類對照表（以 id 為 key） */
  colors: Record<string, ColorCategory>;
  /** 使用中的標籤清單 */
  tags: string[];
  /** 新增顏色分類 */
  addColor: (label: string, swatch: string) => ColorCategory;
  /** 更新顏色分類（不可變更 id） */
  updateColor: (id: string, patch: Partial<Omit<ColorCategory, "id">>) => void;
  /** 刪除顏色分類 */
  deleteColor: (id: string) => void;
  /** 新增標籤 */
  addTag: (tag: string) => void;
  /** 重新命名標籤 */
  updateTag: (oldTag: string, newTag: string) => void;
  /** 刪除標籤 */
  deleteTag: (tag: string) => void;
};

/** 本地儲存使用的鍵名。 */
const STORAGE_KEY = "paperflow:taxonomy";

/** 從本地儲存載入分類與標籤，失敗時回傳 null。 */
function loadFromStorage(): Pick<TaxonomyState, "colors" | "tags"> | null {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as any;
  } catch {
    return null;
  }
}

/** 將分類與標籤狀態序列化後寫入本地儲存。 */
function saveToStorage(state: Pick<TaxonomyState, "colors" | "tags">) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

/** 將輸入字串轉為簡單可用的 slug。 */
function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "cat";
}

/** 初始預設的顏色分類集合。 */
const DEFAULT_COLORS: Record<string, ColorCategory> = {
  idea: { id: "idea", label: "靈感", swatch: "#facc15" },
  method: { id: "method", label: "方法", swatch: "#38bdf8" },
  result: { id: "result", label: "結果", swatch: "#f472b6" },
};

/**
 * useTaxonomyStore：提供顏色分類與標籤的狀態管理，並與 localStorage 同步。
 */
export const useTaxonomyStore = create<TaxonomyState>((set, get) => {
  const initial = loadFromStorage();
  const initColors = initial?.colors ?? DEFAULT_COLORS;
  const initTags = initial?.tags ?? [];
  return {
    colors: initColors,
    tags: initTags,
    addColor: (label, swatch) => {
      const base = slugify(label);
      const state = get();
      let id = base;
      let i = 1;
      while (state.colors[id]) {
        i += 1;
        id = `${base}-${i}`;
      }
      const cat: ColorCategory = { id, label: label || id, swatch };
      const next = { ...state.colors, [id]: cat };
      set({ colors: next });
      saveToStorage({ colors: next, tags: state.tags });
      return cat;
    },
    updateColor: (id, patch) => {
      const state = get();
      const current = state.colors[id];
      if (!current) return;
      const updated = { ...current, ...patch } as ColorCategory;
      const next = { ...state.colors, [id]: updated };
      set({ colors: next });
      saveToStorage({ colors: next, tags: state.tags });
    },
    deleteColor: (id) => {
      const state = get();
      const { [id]: _, ...rest } = state.colors;
      set({ colors: rest });
      saveToStorage({ colors: rest, tags: state.tags });
    },
    addTag: (tag) => {
      const state = get();
      const value = tag.trim();
      if (!value || state.tags.includes(value)) return;
      const nextTags = [value, ...state.tags];
      set({ tags: nextTags });
      saveToStorage({ colors: state.colors, tags: nextTags });
    },
    updateTag: (oldTag, newTag) => {
      const state = get();
      const next = state.tags.map((t) => (t === oldTag ? newTag : t));
      set({ tags: next });
      saveToStorage({ colors: state.colors, tags: next });
    },
    deleteTag: (tag) => {
      const state = get();
      const next = state.tags.filter((t) => t !== tag);
      set({ tags: next });
      saveToStorage({ colors: state.colors, tags: next });
    },
  };
});
