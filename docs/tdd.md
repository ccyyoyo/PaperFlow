# PaperFlow TDD（Test-Driven Development 指南）

本文件說明測試分層、工具與命名規範、工作流程與覆蓋率門檻，支援 Windows 目標平台。

---

## 1. 測試分層與工具

- Rust 後端
  - 單元：`cargo test`，建議 `rstest` 輔助表格化測試。
  - 整合：`src-tauri/tests/` 以臨時 SQLite（位於 `%TEMP%`）進行 DB/服務整合測試。
  - 模擬：必要時 `mockall`；FTS 測試可使用小型測試資料集。

- 前端（React/TS）
  - 單元：Vitest（Vite 默認），React Testing Library 驅動組件。
  - 模擬 IPC：以輕量 wrapper 注入假 `invoke/listen`（避免耦合 Tauri runtime）。
  - 覆蓋率：`vitest --coverage`，門檻見下。

- 端對端（E2E）
  - Playwright（Windows 10/11）：PDF 開啟、筆記建立、搜尋、回顧主流程。
  - 高 DPI/多螢幕：以啟動參數切換縮放，檢查 UI 佈局與互動。

---

## 2. 結構與命名規範

- Rust：
  - 檔案：與模組同名 `*_test.rs` 或模組內 `mod tests {}`。
  - 命名：`fn creates_note_when_text_selected()`；Given/When/Then 註解可選。

- 前端：
  - 檔案：`app/src/**/__tests__/*.{test,spec}.ts(x)`。
  - 命名：`it('opens pdf under 1s')`；使用 `describe` 分群。

- E2E：
  - 位置：`tests/e2e/*.{spec.ts}`；可用標籤 `@slow @e2e` 區分。

---

## 3. 覆蓋率與驗收門檻

- Rust/TS 單元：行數與分支覆蓋 ≥ 80%。
- 端對端：涵蓋 MVP 主流程（開啟 PDF → 筆記 → 搜尋 → 回顧）。
- 效能驗收：
  - 開啟 30MB PDF < 1s（暖 cache 下 < 600ms）。
  - 新增筆記 < 50ms；搜尋首 20 筆 < 150ms。

---

## 4. TDD 工作流程

1) 寫失敗的測試（紅）：以 PRD/BDD User Story 驅動。
2) 最小實作讓測試通過（綠）：避免一次做太多。
3) 重構：清晰邊界、移除重複、強化命名與型別。
4) 提交：訊息包含「測試 → 實作 → 重構」摘要；保留測試可讀性。

---

## 5. 測試資料與環境

- SQLite：使用臨時 DB；每次測試重建 schema；啟用外鍵與索引。
- PDF 測試檔：
  - 小：10–20 頁、含文字層。
  - 大：300–500 頁、20–50MB；必要時提供無文字層掃描檔。
- IPC：對 commands 以 service 注入假件（避免真正 IO）。

---

## 6. CI 建議

- Rust：`cargo test --locked`；可加 `--release` 觀察效能。
- 前端：`pnpm vitest run --coverage`。
- E2E：Playwright 安裝瀏覽器依賴；以標籤分流（PR 僅跑快速子集）。

