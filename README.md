# 📘 PaperFlow (Tauri Edition)

### 「專為研究者設計的筆記導向 PDF 閱讀器」

---

## 🎯 一句話定位

&gt; 一個讓研究者能 **流暢閱讀、即時筆記、輕鬆回顧** 的桌面閱讀器。
&gt; 所有功能都圍繞「閱讀 → 理解 → 回顧」這條路線。

---

## 🧠 核心體驗目標

| 面向 | 目標                       |
| -- | ------------------------ |
| 速度 | 開啟 PDF &lt; 1 秒、滾動不卡、筆記即時儲存 |
| 操作 | 選文字即開筆記框、鍵盤快捷鍵順手、搜尋即跳轉   |
| 回顧 | 一週內重點回顧、常見標籤統計、自動生成報告    |
| 穩定 | 不吃資源、不崩潰、支援大檔 PDF        |

---

## 🧩 核心功能清單

### 1️⃣ Workspace 層級（研究主題管理）

&gt; 幫你把所有 paper 和筆記歸到一個研究主題底下。

* 每個 Workspace 對應一個研究方向（例：「LLM Alignment」）
* 可包含多篇 PDF 與筆記
* 左側導覽列呈現階層：

  ```
  Workspace
   ├─ Paper A
   │   ├─ Notes
   │   └─ Highlights
   ├─ Paper B
   └─ Review Summary
  ```
* Workspace 可匯出 / 匯入（JSON + 附檔案連結）

📂 **資料設計提示**

```sql
workspace(id TEXT PRIMARY KEY, name TEXT, createdAt TEXT)
paper(id TEXT PRIMARY KEY, workspaceId TEXT, title TEXT, path TEXT, doi TEXT)
```

---

### 2️⃣ 智慧筆記（PDF 連動）

&gt; 不跳出閱讀節奏，筆記與段落一一對應。

* 選取文字 → 立即彈出筆記框
* 筆記自動記錄頁碼、錨點（用於卡片對齊）、原文字內容
* 點筆記可高亮原段落
* 支援 Markdown + 富文本編輯（TipTap）
* 筆記分顏色（方法 / 結果 / 靈感）

#### 筆記卡片側欄（Card Sidebar）
&gt; 以「卡片」方式瀏覽筆記，並可選擇跟隨 PDF 或獨立瀏覽。

* **分開模式（Free）**：側欄可自由捲動；點卡片可跳回 PDF 對應頁面。
* **對齊模式（Follow / 對齊）**：按下「對齊」會回到目前 PDF 頁面的卡片並開始跟隨（卡片頂端與選取文字上緣對齊）。

🧱 **Rust 模組建議**

```rust
// pdf_note_anchor.rs
// 最小錨點：只需要垂直對齊（不覆蓋在文字上）。
// y_top_norm 為 0~1：相對於該頁高度的選取文字上緣位置。
pub struct NoteAnchor {
  pub page: i32,
  pub y_top_norm: f32,
  pub pdf_fingerprint: String,
  pub quote: Option<String>,
}
```

📂 **資料表**

```sql
note(id TEXT, paperId TEXT, page INT, anchor_y_top_norm REAL, content TEXT, color TEXT, tags TEXT)
```

---

### 3️⃣ 快速筆記流（Quick Flow）

&gt; 最小摩擦筆記體驗。

* 選取文字 → 自動聚焦筆記框（不需點擊）
* 全域快捷鍵 `Ctrl+E` 新筆記
* `Ctrl+K` → Quick Command 面板
  （搜尋筆記 / 跳頁 / 切換 Workspace）
* 可在任何時刻按 `Ctrl+Shift+Space` 呼出 Quick Note 視窗（獨立小窗）

🧠 **技術說明**

* 全域快捷鍵：`tauri::global_shortcut`
* 小筆記窗使用 Tauri window manager，無邊框浮動
* 前端 React Portal + CSS transition 控制彈出

---

### 4️⃣ 全文搜尋（PDF + 筆記）

&gt; 一次搜尋所有內容：原文、標註、筆記。

* 支援模糊搜尋
* 結果同時顯示 PDF 段落與筆記
* 點擊直接跳轉
* Rust 後端使用 SQLite FTS5 全文索引

📂 **資料表**

```sql
search_index(content TEXT, refType TEXT, refId TEXT)
-- refType = 'pdf' or 'note'
```

---

### 5️⃣ 上下文預覽（Context Hover Preview）

&gt; 讓連結筆記能快速預覽，不打斷閱讀流。

* 筆記內引用 `[[note]]` → hover 顯示預覽卡
* 如果引用到 PDF 段落 → 顯示該頁縮圖 + 原文前後句
* 支援「固定在右側」對照檢視

🧠 **技術建議**

* Rust 提供 `/api/preview?id=` 介面
* 前端使用 React lazy component 顯示卡片
* 用 IntersectionObserver 控制顯示與載入時機

---

### 6️⃣ 回顧與統計（Review Mode）

&gt; 幫你定期回顧重點，累積閱讀成果。

* 自動生成每週報告：

  * 本週新增筆記數
  * 最常見標籤
  * 閱讀時間統計（來自後端記錄）
* 自動提醒回顧「7 天前的筆記」

📂 **資料表**

```sql
note_stats(noteId TEXT, lastReviewedAt TEXT, reviewCount INT DEFAULT 0)
paper_stats(paperId TEXT, totalReadTime INT, lastOpenedPage INT)
```

🧠 **Rust 模組建議**

```rust
// reading_tracker.rs
pub fn track_read_time(paper_id: &str, seconds: u32) {
    // 寫入 SQLite 累積時間
}
```

---

### 7️⃣ 效能與穩定性設計

&gt; 研究用大 PDF 是常態，必須流暢。

* **Lazy rendering**：pdf.js 只渲染可見頁
* **多執行緒**：Rust 處理 PDF parsing、搜尋索引
* **UI / I/O 分離**：React 前端只接後端事件流
* **快取策略**：

  * 每個 PDF 有 cache 檔 (page bitmap, metadata)
  * 筆記在 Rust memory cache 暫存（減少 SQLite I/O）

---

## 🧰 技術棧

| 模組         | 技術                                         |
| ---------- | ------------------------------------------ |
| 桌面框架       | **Tauri (Rust)**                           |
| 前端框架       | **React + Vite + TypeScript**              |
| PDF Viewer | pdf.js（嵌入 WebView）                         |
| 資料庫        | SQLite + FTS5                              |
| 狀態管理       | Zustand / Jotai                            |
| 富文本編輯      | TipTap                                     |
| 動畫         | Framer Motion                              |
| 快捷鍵        | Tauri global_shortcut + React-hotkeys-hook |
| 圖表 / 統計    | Recharts (for review report)               |

---

## ⚙️ 系統架構（文字版）

```
+-------------------------------+
|         Frontend (React)      |
|-------------------------------|
| PDF Viewer (pdf.js)           |
| Notes UI (TipTap)             |
| Search UI                     |
| Review Dashboard              |
+-------------------------------+
           │
           ▼
+-------------------------------+
|       Tauri (Rust Backend)    |
|-------------------------------|
| pdf_parser.rs (頁面解析)       |
| note_manager.rs (筆記 CRUD)    |
| search_engine.rs (FTS5 索引)  |
| stats_tracker.rs (閱讀時間)   |
| settings.rs (設定管理)        |
+-------------------------------+
           │
           ▼
+-------------------------------+
|           SQLite DB           |
+-------------------------------+
```

---

## 💾 資料庫結構總覽

```sql
workspace(id, name, createdAt)
paper(id, workspaceId, title, doi, path)
note(id, paperId, page, anchor_y_top_norm, content, color, tags, createdAt)
link(fromNoteId, toNoteId)
note_stats(noteId, reviewCount, lastReviewedAt)
paper_stats(paperId, totalReadTime, lastOpenedPage)
search_index(content, refType, refId)
```

---

## 🚀 開發路線建議（MVP → 完整版）

| 階段       | 重點                         | 目標        |
| -------- | -------------------------- | --------- |
| **MVP**  | 開啟 PDF + 筆記 + 搜尋           | 確保流暢體驗    |
| **v1.1** | Workspace + Review Mode    | 能整理研究     |
| **v1.2** | 上下文預覽 + 快速筆記流              | 操作流順、閱讀沉浸 |
| **v2.0** | 效能優化（Rust threading、cache） | 穩定支援大檔    |
| **v3.0** | 雲同步 / 協作（可選）               | 進階功能擴展    |

---

## 💬 開發提醒

* 優先確保 **PDF 渲染 + 筆記操作** 流暢度
* 所有資料都**本地可用**，再考慮雲同步
* Rust 模組要設計成「可熱插拔」（獨立職責）
* 用 SQLite schema version 控管資料升級

---
技術選型（簡潔版）

桌面：Tauri（Rust 後端，WebView 前端）

前端：React + Vite + TS + Tailwind + TipTap + Zustand

PDF：pdf.js（WebView 中跑，Worker 模式）

DB：SQLite + FTS5（rusqlite or sea-orm）

IPC：Tauri Commands（Rust &lt;-&gt; JS）

圖表：Recharts（Review dashboard）

測試：Vitest（前端）、Rust #[test]（後端）
