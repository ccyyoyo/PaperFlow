import { create } from "zustand";

export type ToastKind = "success" | "info" | "error";

export type Toast = {
  id: string;
  kind: ToastKind;
  message: string;
};

interface ToastState {
  items: Toast[];
  show: (kind: ToastKind, message: string, opts?: { timeoutMs?: number }) => void;
  remove: (id: string) => void;
  clear: () => void;
}

function genId() {
  try {
    const v = (globalThis as any)?.crypto?.randomUUID?.();
    if (v) return v as string;
  } catch {}
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export const useToast = create<ToastState>((set, get) => ({
  items: [],
  show: (kind, message, opts) => {
    const id = genId();
    const toast: Toast = { id, kind, message };
    set((s) => ({ items: [toast, ...s.items].slice(0, 4) }));
    const timeout = opts?.timeoutMs ?? 2200;
    if (timeout > 0) {
      setTimeout(() => get().remove(id), timeout);
    }
  },
  remove: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
  clear: () => set({ items: [] }),
}));

