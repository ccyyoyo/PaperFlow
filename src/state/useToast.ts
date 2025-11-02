/**
 * 檔案說明：
 * Toast 通知的共享狀態（佇列管理、顯示與自動清除）。
 */
import { create } from "zustand";

/** Toast 類型（成功／資訊／錯誤）。 */
export type ToastKind = "success" | "info" | "error";

/** Toast 項目。 */
export type Toast = {
  /** 唯一識別 */
  id: string;
  /** 類型 */
  kind: ToastKind;
  /** 顯示訊息 */
  message: string;
};

/** Toast 狀態與操作介面。 */
interface ToastState {
  /** 目前顯示中的 Toast 佇列 */
  items: Toast[];
  /** 顯示一則 Toast，可選逾時自動移除 */
  show: (kind: ToastKind, message: string, opts?: { timeoutMs?: number }) => void;
  /** 依 id 移除 Toast */
  remove: (id: string) => void;
  /** 清空所有 Toast */
  clear: () => void;
}

/** 產生唯一識別字串（優先使用 crypto.randomUUID）。 */
function genId() {
  try {
    const v = (globalThis as any)?.crypto?.randomUUID?.();
    if (v) return v as string;
  } catch {}
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** useToast：管理 Toast 佇列的共享狀態。 */
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
