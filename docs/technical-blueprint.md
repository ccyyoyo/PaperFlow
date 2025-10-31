# PaperFlow Tauri 專案技術藍圖

本藍圖針對 Windows 版 PaperFlow（Tauri + Rust + React + pdf.js + SQLite/FTS5），在不改動 PRD 既有方向下，明確定義模組目錄結構、IPC 介面、檔案與程式組織規範，以及建置/封裝與測試要點，作為工程實作依循。

---

## 目標與原則

- Windows 10/11（x64）優先；WebView2、DPI/縮放、中文與長路徑完整支援。
- 流暢與穩定優先：PDF 開啟 < 1s、頁切 < 100ms、筆記 < 50ms、搜尋 < 150ms、常駐 < 400MB。
- 模組邊界清晰：Command（IPC）薄、Service 聚合業務、Domain 單純資料模型。
- 可觀測與可維護：統一 Error 型別、結構化日誌、資料遷移版控、可重建索引。

---

## 專案目錄結構

```
PaperFlow/
├─ docs/
│  ├─ prd.md
│  └─ technical-blueprint.md   ← 本文件
├─ src-tauri/
│  ├─ Cargo.toml
│  ├─ tauri.conf.json
│  ├─ migrations/              ← SQL 腳本（schema 版控）
│  │  ├─ 0001_init.sql
│  │  └─ 0002_add_tags.sql
│  └─ src/
│     ├─ main.rs               ← Tauri 入口與命令註冊
│     ├─ commands/             ← IPC 命令：薄層，做參數驗證與委派
│     │  ├─ mod.rs
│     │  ├─ paper.rs           ← 匯入/開啟/列表/路徑修復
│     │  ├─ note.rs            ← 新增/更新/刪除/列表
│     │  ├─ search.rs          ← 搜尋/重建索引/進度
│     │  ├─ review.rs          ← 統計與回顧
│     │  ├─ preview.rs         ← 上下文預覽
│     │  ├─ settings.rs        ← 設定存取
│     │  └─ shortcuts.rs       ← 全域快捷鍵註冊/釋放
│     ├─ services/             ← 業務服務：資料庫與核心邏輯
│     │  ├─ db.rs              ← SQLite 連線池、交易、migrate
│     │  ├─ repo.rs            ← CRUD（paper/note/tag/...）
│     │  ├─ search/
│     │  │  ├─ mod.rs
│     │  │  └─ fts.rs          ← FTS5 寫入/查詢、n-gram/結巴
│     │  ├─ pdf/
│     │  │  ├─ anchor.rs       ← 錨點策略（文字哈希/座標/快照）
│     │  │  └─ snapshot.rs     ← 段落快照（選配）
│     │  ├─ stats/
│     │  │  └─ tracker.rs      ← 閱讀時間/回顧統計
│     │  ├─ file_watch.rs      ← 檔案遺失/搬移偵測
│     │  ├─ cache.rs           ← LRU 快取（頁面位圖/metadata）
│     │  ├─ config.rs          ← 設定存取 `%APPDATA%`
│     │  └─ migration.rs       ← user_version 管理
│     ├─ domain/               ← Domain 模型（資料表映射）
│     │  ├─ mod.rs
│     │  ├─ workspace.rs
│     │  ├─ paper.rs
│     │  ├─ note.rs
│     │  ├─ tag.rs
│     │  ├─ stats.rs
│     │  └─ search.rs
│     ├─ telemetry/
│     │  ├─ logging.rs         ← tracing + 檔案輪替
│     │  └─ error.rs           ← thiserror/anyhow → IPC 錯誤碼
│     └─ utils/
│        ├─ path.rs            ← Windows 路徑/長路徑/編碼
│        └─ time.rs
└─ app/
   ├─ package.json
   ├─ vite.config.ts
   ├─ tsconfig.json
   ├─ public/
   └─ src/
      ├─ main.tsx
      ├─ app.tsx
      ├─ routes/
      │  ├─ workspace/
      │  ├─ paper/
      │  └─ review/
      ├─ components/
      │  ├─ pdf-viewer/        ← 嵌入 pdf.js + worker
      │  ├─ note-editor/       ← TipTap
+     │  ├─ search-panel/
      │  ├─ quick-note/
      │  └─ preview-card/
      ├─ state/                ← Zustand/Jotai store
      ├─ ipc/                  ← IPC 包裝與型別
      │  ├─ index.ts           ← 泛用 invoke/onEmit
      │  ├─ commands.ts        ← 具名命令封裝
      │  └─ schemas.ts         ← zod 型別驗證
      ├─ types/                ← 共享型別（與 Rust 對照）
      ├─ utils/
      └─ styles/
```

---

## IPC 介面定義（Commands + Events）

約定：
- 命名以點號分段，如 `paper.open`、`note.create`；Rust 對應函數以蛇形命名。
- 請求/回應皆為 JSON；錯誤統一以 `{ code, message, details? }`。
- 參數前端以 zod 驗證；後端再做邊界檢查與錯誤碼分類。

### 1) Commands（Rust）

註冊於 `src-tauri/src/main.rs`：

```rust
#[tauri::command]
async fn paper_open(paper_id: String) -> Result<Paper, IpcError> { /* ... */ }

#[tauri::command]
async fn paper_import(paths: Vec<String>, workspace_id: String) -> Result<Vec<Paper>, IpcError> { /* hash/去重/入庫 */ }

#[tauri::command]
async fn note_create(input: NewNote) -> Result<Note, IpcError> { /* 建錨點+存DB+emit */ }

#[tauri::command]
async fn note_update(input: UpdateNote) -> Result<Note, IpcError> { /* ... */ }

#[tauri::command]
async fn note_delete(note_id: String) -> Result<(), IpcError> { /* ... */ }

#[tauri::command]
async fn search_query(q: String, limit: u32) -> Result<Vec<SearchHit>, IpcError> { /* FTS5 + 排序 */ }

#[tauri::command]
async fn search_rebuild() -> Result<(), IpcError> { /* 背景重建 + emit 進度 */ }

#[tauri::command]
async fn stats_track_read_time(paper_id: String, seconds: u32) -> Result<(), IpcError> { /* ... */ }

#[tauri::command]
async fn preview_get(ref_type: String, ref_id: String) -> Result<PreviewCard, IpcError> { /* note/pdf 片段 */ }

#[tauri::command]
async fn settings_get() -> Result<AppSettings, IpcError> { /* ... */ }

#[tauri::command]
async fn settings_set(s: AppSettings) -> Result<(), IpcError> { /* ... */ }

#[tauri::command]
async fn shortcut_register(k: String, action: String) -> Result<(), IpcError> { /* 全域註冊 */ }

#[tauri::command]
async fn shortcut_unregister(k: String) -> Result<(), IpcError> { /* 釋放 */ }
```

對應 TypeScript 包裝（`app/src/ipc/commands.ts`）：

```ts
export const NoteCmd = {
  create: (input: NewNote) => invoke<Note>('note_create', { input }),
  update: (input: UpdateNote) => invoke<Note>('note_update', { input }),
  del: (noteId: string) => invoke<void>('note_delete', { noteId }),
};

export const SearchCmd = {
  query: (q: string, limit = 20) => invoke<SearchHit[]>('search_query', { q, limit }),
  rebuild: () => invoke<void>('search_rebuild'),
};
```

主要資料結構（Rust，`domain/*`）與 TS 型別（`app/src/types/*`）需一一對照：

```rust
pub struct Note { pub id: String, pub paper_id: String, pub page: i32, pub x: f32, pub y: f32, pub content: String, pub color: String, pub created_at: String, pub updated_at: String }
pub struct NewNote { pub paper_id: String, pub page: i32, pub x: f32, pub y: f32, pub content: String, pub color: Option<String> }
pub struct UpdateNote { pub id: String, pub content: Option<String>, pub color: Option<String> }
```

```ts
export type Note = { id: string; paperId: string; page: number; x: number; y: number; content: string; color: string; createdAt: string; updatedAt: string };
export type NewNote = { paperId: string; page: number; x: number; y: number; content: string; color?: string };
export type UpdateNote = { id: string; content?: string; color?: string };
```

### 2) Events（後端主動推送）

- `paper:opened` → `{ paperId }`
- `file:missing` / `file:relinked` → `{ paperId, path, lastSeenPath }`
- `note:created` | `note:updated` | `note:deleted` → `{ note } | { id }`
- `search:index:progress` → `{ done, total, stage }`
- `review:reminder` → `{ notes: Note[] }`
- `shortcut:failed` → `{ key, reason }`
- `cache:evicted` → `{ kind, count }`

前端監聽（`app/src/ipc/index.ts`）：

```ts
import { listen } from '@tauri-apps/api/event';
listen('note:created', ({ payload }) => {/* 更新 store */});
```

---

## 檔案與程式組織規範

- 命名與風格：
  - Rust：edition 2021，`rustfmt`、`clippy`；模組蛇形、型別帕斯卡。
  - TS：`"strict": true`，ES2020，Path alias `@/*` 指向 `app/src/*`。
- 邊界與依賴：
  - `commands/*` 僅做參數驗證、錯誤轉換與服務委派；不得直連 DB。
  - `services/*` 聚合交易與商業邏輯；`repo.rs` 提供精簡 CRUD。
  - `domain/*` 僅資料結構與轉換（Serde 序列化）。
- 錯誤規格：
  - `IpcError { code: &'static str, message: String, details: Option<Value> }`
  - 類別：`bad_request`、`not_found`、`conflict`、`io_error`、`db_error`、`internal`。
- 日誌：
  - `tracing` + 檔案輪替（每日/大小），路徑 `%LOCALAPPDATA%/PaperFlow/logs`。
  - 事件/命令以 `target` 標註，如 `ipc.note`, `svc.search`。
- 設定：
  - `%APPDATA%/PaperFlow/config.json`；zod/Rust schema 互相對齊；支援匯入/匯出與預設重設。
- DB 與遷移：
  - `PRAGMA user_version` 管控；`migrations/*.sql` 明確、向前為主；升級前自動快照 DB。
  - 外鍵開啟、索引齊備；`fileHash` 用於 Paper 去重。
- 快取策略：
  - 頁面位圖 LRU（大小上限可配置）；metadata JSON 以檔案時間/大小校驗。
- 檔案監控：
  - 以 `notify` 監測；遺失/搬移發出 `file:*` 事件並引導重新定位。

---

## PDF 與錨點

- pdf.js 於前端 WebView：
  - 正確打包 worker；以 `PDFLinkService` 輔助定位跳轉。
  - 選取文字在前端擷取前後文，送後端產生 `text_hash` 與正規化座標。
- 錨點回復（後端 `services/pdf/anchor.rs`）：
  1) 文字哈希 + 段落索引（首選）
  2) 規格化座標（與縮放無關）
  3) 段落快照圖塊 hash（漂移補償）
- 掃描 PDF（無文字層）：
  - MVP 以座標為主；v2 可選 OCR（tesseract/leptess）後再入索引。

---

## 搜尋（FTS5 + CJK）

- 寫入管線：前端擷取文字 → 後端預分詞 → `search_index(content, refType, refId)`。
- 分詞策略：預設 3-gram；進階可切換 `jieba-rs`。
- 排序：BM25 權重（筆記 > 原文段落）。
- 片段預覽：儲存 offset 或摘要；高亮避免中文字切割。
- 重建索引：背景任務，periodic emit `search:index:progress`。

---

## 快捷鍵（Windows）

- 全域：`Ctrl+E`、`Ctrl+Shift+Space`；應用：`Ctrl+K`、`Ctrl+F`；可自訂並寫入 config。
- 註冊失敗降級策略；IME 輸入期間不攔截。

---

## 設定與儲存路徑（Windows）

- DB：`%APPDATA%/PaperFlow/db.sqlite`
- 快取：`%LOCALAPPDATA%/PaperFlow/cache`
- 設定：`%APPDATA%/PaperFlow/config.json`
- 日誌：`%LOCALAPPDATA%/PaperFlow/logs`

---

## 建置與封裝（Windows）

- 安裝：NSIS/MSI；包含或引導安裝 WebView2 Runtime。
- 簽章：Authenticode（EV 可選）。
- 更新：Tauri Updater（可選）；更新前先做 DB 快照。

---

## 測試策略

- Rust 單元：錨點回復、FTS 分詞/查詢、遷移腳本、檔案監控。
- 前端單元：筆記編輯（TipTap）、指令面板、搜尋高亮。
- 端對端（Windows 10/11）：建立→搜尋→回顧；高 DPI 與多螢幕；大型 PDF 負載。

---

## 範例：命令與事件骨架

Rust（`src-tauri/src/commands/note.rs`）

```rust
use crate::{services::{db::Db, repo,}, telemetry::error::IpcError};
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize)]
pub struct NewNote { pub paper_id: String, pub page: i32, pub x: f32, pub y: f32, pub content: String, pub color: Option<String> }

#[tauri::command]
pub async fn note_create(state: tauri::State<'_, Db>, input: NewNote, app: tauri::AppHandle) -> Result<serde_json::Value, IpcError> {
  let note = repo::create_note(&state, input).await?;
  app.emit_all("note:created", &note).ok();
  Ok(serde_json::to_value(note).unwrap())
}
```

TS（`app/src/ipc/index.ts`）

```ts
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

export const invokeSafe = async <T>(cmd: string, payload?: any): Promise<T> => {
  try { return await invoke<T>(cmd, payload); } catch (e: any) { /* 轉換為統一錯誤 */ throw e; }
};

listen('note:created', ({ payload }) => {
  // TODO: 更新 store
});
```

---

## 實作里程碑（對應 PRD）

1. 基礎框架：目錄、DB 連線、命令註冊、設定與日誌
2. PDF 檢視與筆記：選取→錨點→筆記→同步高亮
3. 搜尋：寫入管線、FTS 查詢、結果跳轉、索引重建
4. 回顧與統計：閱讀時間、每週報告、提醒事件
5. 匯出/匯入：`workspace.json + attachments/`、hash 去重
6. 穩定與效能：快取、檔案監控、DPI 與長路徑、壓力測試

