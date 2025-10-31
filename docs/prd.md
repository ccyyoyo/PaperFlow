# 📘 PaperFlow (Tauri Edition)

### 「專為研究者設計的筆記導向 PDF 閱讀器」

---

## 🎯 一句話定位

> 一個讓研究者能 **流暢閱讀、即時筆記、輕鬆回顧** 的桌面閱讀器。
> 所有功能都圍繞「閱讀 → 理解 → 回顧」這條路線。

---

## 🧠 核心體驗目標

| 面向 | 目標                       |
| -- | ------------------------ |
| 速度 | 開啟 PDF < 1 秒、滾動不卡、筆記即時儲存 |
| 操作 | 選文字即開筆記框、鍵盤快捷鍵順手、搜尋即跳轉   |
| 回顧 | 一週內重點回顧、常見標籤統計、自動生成報告    |
| 穩定 | 不吃資源、不崩潰、支援大檔 PDF        |

---

## 🧩 核心功能清單

### 1️⃣ Workspace 層級（研究主題管理）

> 幫你把所有 paper 和筆記歸到一個研究主題底下。

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

> 不跳出閱讀節奏，筆記與段落一一對應。

* 選取文字 → 立即彈出筆記框
* 筆記自動記錄頁碼、座標、原文字內容
* 點筆記可高亮原段落
* 支援 Markdown + 富文本編輯（TipTap）
* 筆記分顏色（方法 / 結果 / 靈感）

🧱 **Rust 模組建議**

```rust
// pdf_note_anchor.rs
// 將座標(x, y) 與頁面 hash 存入資料庫，防止渲染後位移。
pub struct NoteAnchor {
  pub page: i32,
  pub x: f32,
  pub y: f32,
  pub text_hash: String,
}
```

📂 **資料表**

```sql
note(id TEXT, paperId TEXT, page INT, x REAL, y REAL, content TEXT, color TEXT, tags TEXT)
```

---

### 3️⃣ 快速筆記流（Quick Flow）

> 最小摩擦筆記體驗。

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

> 一次搜尋所有內容：原文、標註、筆記。

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

> 讓連結筆記能快速預覽，不打斷閱讀流。

* 筆記內引用 `[[note]]` → hover 顯示預覽卡
* 如果引用到 PDF 段落 → 顯示該頁縮圖 + 原文前後句
* 支援「固定在右側」對照檢視

🧠 **技術建議**

* Rust 提供 `/api/preview?id=` 介面
* 前端使用 React lazy component 顯示卡片
* 用 IntersectionObserver 控制顯示與載入時機

---

### 6️⃣ 回顧與統計（Review Mode）

> 幫你定期回顧重點，累積閱讀成果。

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

> 研究用大 PDF 是常態，必須流暢。

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

## 💾 資料庫結構總覽（新版）

```sql
workspace(
  id,
  name,
  createdAt,
  updatedAt
)

paper(
  id,
  workspaceId,
  title,
  doi,
  path,
  lastSeenPath,
  fileHash,
  filesize,
  createdAt,
  updatedAt
)

note(
  id,
  paperId,
  page,
  x,
  y,
  content,
  color,
  createdAt,
  updatedAt
)

tag(
  id,
  name,
  color,
  createdAt
)

note_tag(
  noteId,
  tagId
)

note_stats(
  noteId,
  reviewCount,
  lastReviewedAt
)

paper_stats(
  paperId,
  totalReadTime,
  lastOpenedPage
)

search_index(
  content,
  refType, -- 'pdf' | 'note'
  refId
)
```

> 註：實作時請啟用 SQLite 外鍵、建立 `paper.workspaceId`、`note.paperId,page` 等索引；`fileHash` 作為 Paper 去重標識。

---

## 🚀 開發路線建議（MVP → 完整版）

| 階段       | 重點                         | 目標        |
| -------- | -------------------------- | --------- |
| **MVP**  | 開啟 PDF + 筆記 + 搜尋           | 確保流暢體驗    |
| **v1.1** | Workspace + Review Mode    | 能整理研究     |
| **v1.2** | 上下文預覽 + 快速筆記流              | 操作流順、閱讀沉浸 |
| **v2.0** | 效能優化（Rust threading、cache） | 穩定支援大檔    |
| **v3.0** | 雲同步 / 協作（可選）               | 進階功能擴展    |
| **v4.0** | AI（可選）               | 進階功能擴展    |

---

## 💬 開發提醒

* 優先確保 **PDF 渲染 + 筆記操作** 流暢度
* 所有資料都**本地可用**，再考慮雲同步
* Rust 模組要設計成「可熱插拔」（獨立職責）
* 用 SQLite schema version 控管資料升級

---

## 🪟 平台與相依（Windows 目標）

- 目標平台：Windows 10 / 11（x64）。
- WebView：Microsoft Edge WebView2（安裝包需內建或啟動引導安裝）。
- DPI/縮放：支援高 DPI（125%/150%）與多螢幕縮放一致性。
- 路徑與編碼：完整支援中文路徑、空白與長路徑（必要時使用 `\\?\` 前綴）。
- 鍵盤：Windows 為主（`Ctrl` 為主修飾鍵），其他作業系統將於未來版本再評估。

---

## 🧱 非功能性需求（Windows）

- 效能目標（以 200–500 頁、20–50MB PDF 為基準）：
  - 開啟應用到可閱讀 < 1 秒
  - 頁間切換 < 100ms
  - 新增/編輯筆記延遲 < 50ms
  - 全文搜尋返回前 20 筆 < 150ms
  - 常駐記憶體 < 400MB（含快取）
- 穩定性：大檔 PDF 長時間開啟不崩潰；I/O 失敗具重試與降級策略。
- 可用性：所有核心操作可離線；資料預設本機保存。
- 可觀測性：本機診斷日誌（預設開最小等級），使用者可一鍵匯出。

---

## 🗄️ 資料模型修訂（取代 `note.tags` 單欄）

> 在不破壞現有敘述下，補充「標籤正規化、外鍵與索引、Paper 去重」設計。

```sql
-- 既有表：補充欄位與外鍵、索引建議
PRAGMA foreign_keys = ON;

workspace(
  id TEXT PRIMARY KEY,
  name TEXT,
  createdAt TEXT,
  updatedAt TEXT
)

paper(
  id TEXT PRIMARY KEY,
  workspaceId TEXT NOT NULL,
  title TEXT,
  doi TEXT,
  path TEXT,            -- 目前實際路徑（可變）
  lastSeenPath TEXT,    -- 最近可用路徑（搬移時追蹤）
  fileHash TEXT,        -- 以檔案內容 SHA-256 作為身分
  filesize INTEGER,
  createdAt TEXT,
  updatedAt TEXT,
  FOREIGN KEY(workspaceId) REFERENCES workspace(id) ON DELETE CASCADE
)

note(
  id TEXT PRIMARY KEY,
  paperId TEXT NOT NULL,
  page INT,
  x REAL,
  y REAL,
  content TEXT,
  color TEXT,
  createdAt TEXT,
  updatedAt TEXT,
  FOREIGN KEY(paperId) REFERENCES paper(id) ON DELETE CASCADE
)

-- 新增正規化的標籤關聯
tag(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  createdAt TEXT,
  UNIQUE(name)
)

note_tag(
  noteId TEXT NOT NULL,
  tagId  TEXT NOT NULL,
  PRIMARY KEY(noteId, tagId),
  FOREIGN KEY(noteId) REFERENCES note(id) ON DELETE CASCADE,
  FOREIGN KEY(tagId)  REFERENCES tag(id)  ON DELETE CASCADE
)

-- 回顧與統計維持不變，可補上索引
note_stats(noteId TEXT PRIMARY KEY, reviewCount INT DEFAULT 0, lastReviewedAt TEXT)
paper_stats(paperId TEXT PRIMARY KEY, totalReadTime INT, lastOpenedPage INT)

-- 全文索引仍以 FTS5 為主
search_index(content TEXT, refType TEXT, refId TEXT)

-- 索引建議
CREATE INDEX IF NOT EXISTS idx_paper_workspace ON paper(workspaceId);
CREATE INDEX IF NOT EXISTS idx_note_paper_page ON note(paperId, page);
CREATE INDEX IF NOT EXISTS idx_note_created ON note(createdAt);
```

---

## 🔎 搜尋與語言（CJK 策略）

- Tokenizer：採用 n-gram（3-gram）或 `jieba-rs` 預分詞，將結果以空白分詞寫入 FTS5。
- 排序：使用 BM25，權重「筆記 > 原文段落」。
- 片段預覽：儲存前後文摘要或偏移（offset），高亮時避免中文字節切割錯位。
- 重建索引：提供一鍵重建，顯示進度與預估時間；不中斷讀寫（分段批次）。

---

## 🎯 錨點策略（PDF 與掃描檔）

- 多源回復：
  - 首選「文字前後文哈希 + 段落索引」
  - 次選「頁碼 + 規格化座標（與縮放無關）」
  - 補償「段落快照圖塊 hash」以對抗小幅漂移
- 掃描 PDF（無文字層）
  - MVP：以頁面圖塊與座標為主；
  - v2：可選 OCR（tesseract/leptess），建立文字層後再入索引。
- 邊界處理：旋轉頁、雙欄排版、異常字距需在規格化時處理。

---

## 📁 檔案與路徑管理（Windows）

- 以 `fileHash` 做 Paper 去重與身分識別；路徑可以變更。
- 檔案監控：監聽檔案遺失/搬移，提供「重新定位檔案」流程。
- 匯出/匯入：
  - 格式：`workspace.json + attachments/`
  - 附件以 `fileHash` 命名；匯入以 hash 去重。
- 快取：頁面位圖 LRU、metadata JSON；可設定上限與清理策略。

---

## 🧭 遷移與備份

- Schema 版控：以 `PRAGMA user_version` 管理；維護向前遷移腳本。
- 升級前自動備份 DB；提供一鍵還原功能。
- 匯出備份：使用者可在 UI 一鍵匯出（含資料與設定）。

---

## 🔐 安全與隱私

- 本機優先：所有資料預設僅存本機。
- 加密（選配）：DB/筆記可啟用密碼保護（SQLCipher 或檔案層加密）。
- 日誌：預設收集最小；不記錄明文筆記內容；使用者可關閉。

---

## ⌨️ 快捷鍵（Windows）

- 預設：`Ctrl+E` 新筆記、`Ctrl+K` 指令面板、`Ctrl+Shift+Space` Quick Note。
- 衝突處理：避免與系統/常見應用衝突；提供使用者自訂。
- 全域快捷鍵由 Tauri `global_shortcut` 管理；失效時提示原因與修復建議。

## ⌨️ 鍵盤快捷鍵一覽（Windows）

| 快捷鍵 | 範圍 | 動作 |
| --- | --- | --- |
| Ctrl + E | 全域 | 新增筆記（選取文字時聚焦筆記框） |
| Ctrl + K | 應用 | 開啟指令面板（搜尋筆記/跳頁/切 Workspace） |
| Ctrl + Shift + Space | 全域 | 開啟 Quick Note 小窗 |
| Ctrl + F | 應用 | 目前文件搜尋（PDF/筆記） |
| Ctrl + Shift + F | 應用 | 全域搜尋（跨 PDF/筆記） |
| PageUp / PageDown | 應用 | 上一頁 / 下一頁 |
| Ctrl + G | 應用 | 跳轉到頁碼 |
| Ctrl + = / Ctrl + - | 應用 | 放大 / 縮小 |
| F11 | 應用 | 全螢幕切換 |
| Ctrl + Z / Ctrl + Y | 編輯 | 復原 / 重做（筆記編輯） |
| F2 | 應用 | 重新命名（Workspace / Paper / 筆記） |

## 🛠️ 快捷鍵自訂規則（Windows）

- 範圍區分：全域（global_shortcut）、應用（視窗存活時）、編輯（文字輸入時）。
- 衝突處理：
  - 迴避系統保留：Win、Alt+F4、Ctrl+Alt+Del、Ctrl+Shift+Esc 等。
  - 全域註冊失敗時，降級為應用層快捷鍵並提示使用者。
- 設定儲存：`%APPDATA%/PaperFlow/config.json`；提供「重設為預設值」。
- 驗證規則：
  - 不允許重複綁定同一範圍；跨範圍重疊需提示可能覆蓋順序。
  - 輸入法（IME）文字輸入中，不攔截字母組合避免干擾輸入。
- 即時生效：應用層快捷鍵可熱更新；全域快捷鍵更新時嘗試重新註冊。
- UI：提供快捷鍵管理頁（搜尋、編輯、檢測衝突、重設）。

---

## 📦 安裝與更新（Windows）

- 安裝包：NSIS 或 MSI，內建/引導安裝 WebView2 Runtime。
- 簽章：支援 Authenticode（EV 可選）。
- 自動更新：Tauri Updater（可選），更新前先行 DB 快照。

---

## 📂 資料存放路徑（Windows）

- 資料庫：`%APPDATA%/PaperFlow/db.sqlite`
- 快取：`%LOCALAPPDATA%/PaperFlow/cache`
- 設定：`%APPDATA%/PaperFlow/config.json`
- 日誌：`%LOCALAPPDATA%/PaperFlow/logs`

---

## ✅ 測試與驗收

- 單元測試：錨點回復、分詞與索引、遷移腳本。
- 效能測試：大型 PDF 載入、搜尋延遲、記憶體峰值與快取命中率。
- 端對端：建立/搜尋/回顧主流程（Windows 10/11），含高 DPI 與多螢幕。
- 驗收門檻：遵守「非功能性需求」之數值目標。
