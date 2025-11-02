/**
 * 檔案說明：
 * Vite 組態（React、開發與預覽埠號）。
 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** 輸出 Vite 設定物件。 */
export default defineConfig(() => ({
  plugins: [react()],
  server: {
    port: 1420,
    strictPort: true
  },
  preview: {
    port: 1420,
    strictPort: true
  }
}));
