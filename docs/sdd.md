# PaperFlow SDD（Software/System Design Document）

本文件定義 PaperFlow（Windows 目標）的系統設計細節，與 PRD、技術藍圖保持一致，作為工程落地與設計決策依據。

---

## 1. 範圍與目標

- 平台：Windows 10/11（x64），WebView2；支援高 DPI、多螢幕、中文/長路徑。
- 目標：PDF 開啟 < 1s、頁切 < 100ms、筆記 < 50ms、搜尋 < 150ms、常駐 < 400MB。
- 架構：Tauri（Rust 後端）+ React（前端）+ pdf.js + SQLite/FTS5。

---

## 2. 高階架構

- Frontend（React）：UI、pdf.js、TipTap、快捷鍵（應用層）、狀態管理（Zustand/Jotai）。
- Backend（Tauri/Rust）：IPC Commands/Events、服務層（DB/搜尋/錨點/統計/檔案監控）、日誌與錯誤。
- Database（SQLite）：正規化 schema（workspace/paper/note/tag/note_tag/...），FTS5 索引。
- Cache：頁面位圖 LRU、metadata JSON；可配置容量與清理策略。
- File Watch：監控 PDF 路徑遺失/搬移，事件引導重新定位。

---

## 3. 元件與職責

- React App
  - PDF Viewer：嵌入 pdf.js，打包 worker；與 Rust 以 IPC 溝通。
  - Notes UI：TipTap 富文本；與錨點同步高亮/跳轉。
  - Search UI：發起查詢、顯示片段、跳轉。
  - Review Dashboard：每週報告、提醒與統計。
  - Shortcuts（應用層）：`Ctrl+K`、`Ctrl+F` 等；全域快捷鍵由 Rust 管理。

- Tauri Backend
  - commands/*：薄層，驗證輸入、委派 services、統一錯誤碼。
  - services/*：DB 存取、FTS 管線、錨點策略、統計、快取、檔案監控、設定。
  - domain/*：資料模型（Serde），與 TS 型別對照。
  - telemetry/*：tracing 日誌、錯誤類型、事件標籤。
  - utils/*：Windows 路徑（長路徑 `\\?\`）、時間與格式化。

- SQLite/FTS5
  - 正規化標籤（tag/note_tag）、外鍵開啟、索引齊備。
  - CJK：n-gram 或結巴預分詞，BM25 權重（筆記 > 原文）。

---

## 4. 資料模型摘要（與 PRD 對齊）

- workspace(id, name, createdAt, updatedAt)
- paper(id, workspaceId, title, doi, path, lastSeenPath, fileHash, filesize, createdAt, updatedAt)
- note(id, paperId, page, x, y, content, color, createdAt, updatedAt)
- tag(id, name, color, createdAt) / note_tag(noteId, tagId)
- note_stats(noteId, reviewCount, lastReviewedAt)
- paper_stats(paperId, totalReadTime, lastOpenedPage)
- search_index(content, refType, refId)

外鍵與索引：參見 PRD「資料模型修訂」。

---

## 5. IPC 介面（摘要）

- Commands：paper_import/open、note_create/update/delete、search_query/rebuild、stats_track_read_time、preview_get、settings_get/set、shortcut_register/unregister。
- Events：paper:opened、file:missing/relinked、note:created/updated/deleted、search:index:progress、review:reminder、shortcut:failed、cache:evicted。
- 錯誤格式：`{ code, message, details? }`；代碼含 `bad_request|not_found|conflict|io_error|db_error|internal`。

---

## 6. 核心流程

- 匯入 Paper：計算 `fileHash` → 去重 → 建立 `paper` → 建 metadata/快取 → 索引入庫。
- 建立筆記：前端擷取文字與座標 → 後端產生 `text_hash` 與正規化座標 → 存 `note` → emit `note:created` → 寫入 FTS。
- 全文搜尋：前端 query → 後端 FTS5（預分詞）→ 排序 → 傳回片段與跳轉資訊。
- 回顧報告：累計閱讀時間（stats_tracker）→ 每週統計輸出 UI。
- 檔案遺失：watcher 發現 → emit `file:missing` → UI 引導重新定位 → 更新 `lastSeenPath`。

---

## 7. 效能與資源

- 多執行緒：PDF 解析/索引/IO 與 UI 分離；任務使用 thread pool。
- 快取：位圖 LRU（上限可設）；metadata JSON；索引重建分段批次，避免阻塞。
- 記憶體：常駐 < 400MB；大型 PDF 釋放未使用頁面。
- 延遲：筆記動作 < 50ms；搜尋首屏結果 < 150ms。

---

## 8. 安全與隱私

- 本機儲存優先；可選 DB 加密（SQLCipher/檔案層）。
- 日誌最小化，避免筆記明文；可關閉或匯出診斷包。
- 設定與資料路徑：`%APPDATA%/PaperFlow`, `%LOCALAPPDATA%/PaperFlow`。

---

## 9. 錯誤處理與可觀測性

- 統一錯誤碼對映；使用 `thiserror/anyhow` 包裝。
- `tracing` 檔案輪替日誌；關鍵命令/事件具 `target` 與 `span`。
- 重要狀態變化一律 emit event，UI 同步 store。

---

## 10. 發佈與更新（Windows）

- 安裝包：NSIS/MSI；包含/引導 WebView2；Authenticode 簽章。
- 更新：Tauri Updater（可選），升級前 DB 快照、失敗可回滾。

---

## 11. 風險與緩解

- CJK 搜尋品質：提供 n-gram 與結巴切換；支援重建索引。
- 掃描 PDF 無文字層：以座標為主，v2 提供 OCR 可選。
- 大檔/長時間開啟：背景釋放與節流；位圖快取上限；監測 OOM 風險。

