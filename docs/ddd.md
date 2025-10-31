# PaperFlow DDD（Domain-Driven Design）

本文以領域模型視角界定共用語言、界限內容（Bounded Contexts）、聚合與不變式、領域事件與政策，支撐技術藍圖與實作。

---

## 1. 共用語言（Ubiquitous Language）

- Workspace：研究主題的容器，含多個 Paper 與其衍生物（Notes、Stats）。
- Paper：單一 PDF 研究文獻，以 `fileHash` 作為身分去重。路徑可變更。
- Note：針對 Paper 某段內容的筆記，與段落透過錨點（text_hash/座標）對應。
- Tag：標籤；與 Note 多對多關係（note_tag）。
- SearchIndex：全文索引，包含 PDF 原文與筆記內容之索引化文字。
- Review：回顧與統計（note_stats、paper_stats）。
- Preview：上下文預覽卡（段落縮圖與前後文）。

---

## 2. 界限內容（Bounded Contexts）

1) Workspace Management
   - 建立/匯入/匯出 Workspace、管理 Paper 清單與結構摘要。

2) Reading & Notes
   - PDF 檢視、文字選取、筆記建立/編輯、錨點回復、高亮同步。

3) Search
   - FTS5 寫入與查詢；CJK 預分詞策略；結果排序與片段產生。

4) Review & Stats
   - 閱讀時間追蹤、每週報告、回顧提醒。

5) Settings & Shortcuts
   - 設定檔、快捷鍵（全域/應用/編輯）、IME 互動與衝突處理。

6) File Management
   - 檔案監控、遺失/搬移重定位、快取與容量管理。

上下文關係：Reading 產生 Note → Search 接收索引 → Review 以筆記/時間為輸入；File Management 與 Workspace、Reading 交疊。

---

## 3. 聚合（Aggregates）與不變式

- Workspace（聚合根）
  - 包含 Papers 清單摘要（非強一致維護）。
  - 不變式：`id` 唯一；刪除 Workspace 需級聯刪除其 Papers。

- Paper（聚合根）
  - 屬性：`fileHash` 唯一、`workspaceId` 外鍵、`path` 可變、`lastSeenPath` 更新策略。
  - 不變式：同一 Workspace 下 `fileHash` 不可重複；路徑變更不影響身分。

- Note（聚合根）
  - 屬性：`paperId`, `page`, `x`, `y`, `content`, `text_hash`（由服務層產生）。
  - 不變式：指向有效的 `paperId`；刪除 Paper 時需移除 Notes；錨點策略保證可回復性（退化到座標）。

- Tag（聚合根）
  - 不變式：`name` 全域唯一；關聯由 `note_tag` 維護。

---

## 4. 倉儲（Repositories）

- WorkspaceRepo：CRUD、匯出/匯入（JSON + attachments/）。
- PaperRepo：以 `fileHash` 去重；重新定位更新 `path/lastSeenPath`。
- NoteRepo：CRUD；寫入後觸發 SearchIndex 寫入。
- TagRepo / NoteTagRepo：名稱唯一、關聯維護；批次更新。
- StatsRepo：累積與查詢；提供報表所需彙整查詢。

---

## 5. 領域事件（Domain Events）

- PaperImported { paperId, fileHash }
- FileMissing { paperId, lastSeenPath }
- FileRelinked { paperId, path }
- NoteCreated { noteId, paperId }
- NoteUpdated { noteId }
- NoteDeleted { noteId }
- SearchIndexed { refType, refId }
- ReviewReminder { notes[] }

事件以 Tauri emit 派送，前端更新 store；部分事件驅動下一步（如 NoteCreated → 索引）。

---

## 6. 政策/流程（Policies/Sagas）

- On NoteCreated → 將內容與上下文寫入 `search_index`；失敗重試與補償。
- On FileMissing → UI 引導重新定位；完成後發出 FileRelinked 並更新 `lastSeenPath`。
- 定時 ReviewReminder → 根據 `lastReviewedAt` 與規則推送提醒。

---

## 7. 反腐層（ACL）

- Search（FTS5）屬技術子域，提供服務層 API（避免將 SQL 與分詞細節滲入領域層）。
- pdf.js 屬前端技術子域，對錨點產生/回復暴露穩定抽象。

---

## 8. 一致性與交易邊界

- Note 與 SearchIndex 為最終一致：筆記存檔成功即回應；索引寫入可非同步，透過事件告知完成。
- Paper 重新定位採單一交易更新；若失敗，保持 `lastSeenPath` 不變並上報錯誤。

