import { create } from "zustand";

export type ColorCategory = {
  id: string;
  label: string;
  swatch: string;
};

type TaxonomyState = {
  colors: Record<string, ColorCategory>;
  tags: string[];
  addColor: (label: string, swatch: string) => ColorCategory;
  updateColor: (id: string, patch: Partial<Omit<ColorCategory, "id">>) => void;
  deleteColor: (id: string) => void;
  addTag: (tag: string) => void;
  updateTag: (oldTag: string, newTag: string) => void;
  deleteTag: (tag: string) => void;
};

const STORAGE_KEY = "paperflow:taxonomy";

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

function saveToStorage(state: Pick<TaxonomyState, "colors" | "tags">) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "cat";
}

const DEFAULT_COLORS: Record<string, ColorCategory> = {
  idea: { id: "idea", label: "靈感", swatch: "#facc15" },
  method: { id: "method", label: "方法", swatch: "#38bdf8" },
  result: { id: "result", label: "結果", swatch: "#f472b6" },
};

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

