# Architecture Overview

PaperFlow is a desktop app that feels like a website but runs entirely on your machine. Four main layers collaborate whenever you open the app or take a note.

### Visual Relationship
```
React + Vite (Frontend UI & Dev Server)
                │
                ▼
          Tauri Shell (Native Window & Bridge)
                │
                ▼
         Rust Backend (Commands & Services)
                │
                ▼
         SQLite Database (Local Persistence)
```

## 1. Frontend (React + Vite)
- Lives inside the browser view that Tauri embeds.
- Draws the PDF reader, note panel, search bar, and review widgets.
- Calls Tauri commands whenever it needs help from Rust (e.g., save a note, run a search).
- Uses the Vite dev server for instant hot reloads while developing.

## 2. Tauri Shell
- Provides the native window on macOS, Windows, and Linux.
- Bridges JavaScript and Rust safely, so local files and OS APIs stay protected.
- Handles system features like file pickers, window controls, notifications, and global shortcuts.

## 3. Rust Backend
- Does the heavy work that the browser alone cannot handle efficiently.
- Planned modules:
  - `pdf_parser`: extracts text, metadata, thumbnails, page sizes.
  - `note_manager`: stores notes, keeps anchor coordinates in sync with PDF pages.
  - `search_engine`: maintains the FTS5 index and returns ranked results.
  - `stats_tracker`: records reading time and prepares review summaries.
- Exposes these capabilities as Tauri commands that the frontend can call.

## 4. SQLite Storage
- Lightweight database file that travels with the app.
- Persists workspaces, papers, notes, links between notes, and search indexes.
- Uses SQLite FTS5 so searches cover both PDF text and notes.

## How Data Flows
1. You interact with the UI (click, type, use shortcuts).
2. React sends a Tauri command with any data it needs to save or fetch.
3. Rust executes business logic, updates SQLite if necessary, and returns a result.
4. React receives the result and refreshes the screen.

This loop keeps the interface responsive while moving CPU-heavy tasks to Rust.

## Local Development Loop
- Run `npm run tauri dev`.
  - Vite serves the React app on port 5173.
  - Tauri opens the desktop window and proxies requests.
- Edit React files → window updates instantly.
- Edit Rust code → Tauri rebuilds the backend before relaunching.

## Future Extensions
- Background jobs in Rust can handle long-running work (e.g., re-indexing large libraries).
- Optional cloud sync or collaboration would sit beside SQLite, syncing through new commands.

Use this document as the starting point; expand sections with diagrams or deeper notes as features ship.

---

## 架構總覽（繁體中文）

PaperFlow 是一個桌面應用程式，看起來像網頁但完全在本機執行。每次開啟應用或新增筆記時，都會由下列四個主要層次協同運作。

#### 層級示意圖
```
React + Vite（前端介面與開發伺服器）
                │
                ▼
          Tauri 外殼（原生視窗與橋接）
                │
                ▼
         Rust 後端（指令與服務模組）
                │
                ▼
         SQLite 資料庫（本機儲存）
```

### 1. 前端（React + Vite）
- 執行在 Tauri 嵌入的瀏覽器視圖內。
- 負責顯示 PDF 閱讀器、筆記面板、搜尋列與回顧小工具。
- 需要後端協助時會呼叫 Tauri Command（例如儲存筆記、執行搜尋）。
- 開發時由 Vite Dev Server 提供即時熱重載。

### 2. Tauri 外殼
- 在 macOS、Windows、Linux 提供原生視窗。
- 安全地橋接 JavaScript 與 Rust，確保本機檔案與作業系統 API 不被濫用。
- 處理系統層級功能：檔案對話框、視窗控制、通知、全域快捷鍵等。

### 3. Rust 後端
- 執行瀏覽器不易處理的較重型工作。
- 主要模組（規劃中）：
  - `pdf_parser`：擷取 PDF 的文字、詮釋資料、縮圖與頁面尺寸。
  - `note_manager`：儲存筆記並維持錨點與 PDF 座標同步。
  - `search_engine`：維護 FTS5 索引並回傳排序後的結果。
  - `stats_tracker`：記錄閱讀時間並整理回顧摘要。
- 透過 Tauri Command 將以上能力提供給前端呼叫。

### 4. SQLite 儲存層
- 輕量的資料庫檔案，隨應用一起存在本機。
- 儲存 Workspace、Paper、Note、筆記連結與搜尋索引。
- 使用 SQLite FTS5，讓搜尋同時涵蓋 PDF 文字與筆記內容。

### 資料流程
1. 使用者在介面上操作（點擊、輸入、快捷鍵）。
2. React 將需要的資料透過 Tauri Command 傳給後端。
3. Rust 執行商業邏輯、必要時更新 SQLite，並回傳結果。
4. React 收到結果後更新畫面。

此循環讓 UI 保持順暢，同時把計算量大的工作交給 Rust 處理。

### 在地開發流程
- 執行 `npm run tauri dev`：
  - Vite 在 5173 埠提供 React 開發伺服器。
  - Tauri 啟動桌面視窗並代理請求。
- 修改 React 程式 → 視窗立即更新。
- 修改 Rust 程式 → Tauri 重新編譯後端並自動重新啟動。

### 未來擴充
- 可以在 Rust 中新增背景工作，處理長時間任務（例如大型資料庫重建索引）。
- 若未來加入雲端同步或協作，可在 SQLite 旁新增對應的指令與同步流程。

本文件提供基礎認知；待功能成熟後可再補上更多圖示與細節說明。
