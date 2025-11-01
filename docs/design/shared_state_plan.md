# Shared State Architecture Plan

建立一致的共享狀態策略，讓 PDF 閱讀、筆記管理、後端命令能在多頁面間協作，同時保留使用者上下文。

## 1. 核心目標
- 同一份 PDF 在切換頁籤（閱讀 / 筆記管理）時維持開啟狀態與頁碼。
- 筆記資料在前端快取並與 Tauri commands 同步，支援離線暫存。
- 提供統一 API 供 React 元件讀寫，減少 props drilling。
- 實作持久化策略（localStorage / SQLite）確保重新啟動仍能回復狀態。

## 2. 狀態領域分解
| 狀態領域 | 主要內容 | 持久化 | 讀寫端 | 備註 |
| --- | --- | --- | --- | --- |
| `viewer.currentPdf` | 檔案路徑/Blob URL、檔名、總頁數 | ✔︎（local + DB） | PdfViewer、NoteManager | 需支援本機檔案，再啟動時自動載入。 |
| `viewer.viewState` | 當前頁碼、縮放、最近載入時間 | ✔︎ | PdfViewer | 切換頁籤後維持。 |
| `notes.collection` | 筆記列表、索引、標籤統計 | ✔︎（SQLite） | NoteManager、PdfViewer | 前端需有快取層。 |
| `notes.editor` | 編輯表單的暫存值 | ✘（短暫） | PdfViewer、未來 Note 表單 | 不需跨頁；保持在元件內即可。 |
| `app.recentFiles` | 最近開啟的 PDF 清單 | ✔︎（localStorage） | App header / 快捷功能 | 提供 quick access。 |
| `app.settings` | 使用者偏好（語系、主題） | ✔︎ | 全域 | 之後擴充。 |

## 3. React 端策略
- **狀態容器**：採用 Zustand 或 React Context + Reducer。建議使用 Zustand（簡潔、支援持久化 middleware）。
- **Provider 放置位置**：在 `main.tsx` 或 `App.tsx` 外層導入 store provider，確保 PdfViewer / NoteManager 共享同一 store。
- **Store 模組**（初版建議拆檔）
  - `src/state/useViewerStore.ts`
  - `src/state/useNotesStore.ts`
  - `src/state/useAppStore.ts`

### useViewerStore (草案)
```ts
interface ViewerState {
  currentPdf: {
    id: string; // hash, uuid
    path: string | null; // 原始路徑
    blobUrl: string | null; // 供 PDF viewer 使用
    name: string;
    totalPages: number;
  } | null;
  viewState: {
    page: number;
    scale: number;
  };
  loadPdf: (payload: { path: string; name: string; blobUrl: string; totalPages: number }) => void;
  setPage: (page: number) => void;
  setScale: (scale: number) => void;
  reset: () => void;
}
```
- 使用 `zustand/middleware` 的 `persist` 將 `currentPdf`、`viewState` 保存到 `localStorage`。
- `loadPdf` 內負責釋放舊 Blob URL（`URL.revokeObjectURL`）。
- PdfViewer 接收到新檔案後呼叫 `loadPdf`，NoteManager 可讀取 `currentPdf` 顯示上下文。

### useNotesStore (草案)
```ts
interface NoteRecord {
  id: string;
  pdfId: string;
  page: number;
  content: string;
  color: NoteColor;
  tags: string[];
  updatedAt: string;
}

interface NotesState {
  notes: NoteRecord[];
  isLoading: boolean;
  loadNotes: (pdfId: string) => Promise<void>;
  createNote: (...) => Promise<void>;
  updateNote: (...) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
}
```
- 初版可先抓取 `currentPdf.id` 的筆記集合存到 `notes`。
- 與 Tauri `list_notes` / `create_note` / `update_note` / `delete_note` 指令整合。
- 支援 optimistic update（操作先更新前端，失敗再回滾）。

### useAppStore (可選)
- 近期開啟的文件列表、全域通知、主題設定。
- 亦可與 `persist` 中介組合，維持使用者最後的 UI 偏好。

## 4. 持久化策略
- `currentPdf`：儲存於 `localStorage` (Zustand persist) + SQLite `workspace` 表同步記錄。
- `viewState`：同 `currentPdf`，在 `useEffect` 監聽 `page` / `scale` 變動時寫入。
- `notes.collection`：主資料仍在 SQLite，store 只快取，目前可擴增 `notes_cache` 表或用 `updatedAt` 判斷要不要重新抓。
- `recentFiles`：沿用 `localStorage`，從 `useAppStore` 提供 `recentFiles` getter/setter。

## 5. 跨頁互動流程
1. 使用者透過 PdfViewer 載入 PDF → `useViewerStore.loadPdf` 更新共享狀態。
2. 切換到 NoteManager → 讀 `useViewerStore.currentPdf` 判斷展示內容、呼叫 `useNotesStore.loadNotes(currentPdf.id)`。
3. 在 NoteManager 編輯或新增筆記 → 呼叫 `useNotesStore` 的動作 → 透過 Tauri command 更新 SQLite → 同步 refresh state。
4. 返回 PdfViewer → 可將 `notes` 傳入 `PdfViewer` 做筆記高亮、側邊列表。

## 6. 後端協作規劃
- `loadPdf` 產生 `pdfId`（可用檔案路徑 hash + workspace id），作為 note 對應的鍵值。
- 擴充 Tauri commands：
  - `list_notes(pdf_id: String)`
  - `create_note(payload)` / `update_note` / `delete_note`
  - `list_recent_files()`（選擇）
- 需要在 Rust 端維持 Blob URL？否，前端自建即可，後端只管路徑與 metadata。

## 7. 待辦項目
- [ ] 決定狀態管理工具（Zustand 或 Context + Reducer）。
- [ ] 實作 `useViewerStore` + `persist` middleware。
- [ ] 實作 `useNotesStore` 銜接 Tauri commands。
- [ ] 將 PdfViewer 與 NoteManager 改為讀寫 store，移除本地 state。
- [ ] 在 App 切換頁籤時保留現有 PDF（不再重新載入）。
- [ ] 寫入資料時寫回 SQLite，並同步更新快取。

## 8. 延伸考量
- **離線支援**：可加入 `syncedAt` 狀態，若離線時允許筆記暫存待補。
- **多 Workspace**：`pdfId` 應包含 workspace id，以區分相同路徑的不同專案。
- **事件通知**：store 可透過 `toast` 或 `notification` 系統告知使用者儲存結果。

以上規劃提供實作指引：先建立 store 及持久化，再重構 PdfViewer / NoteManager，使兩者共享資料，最後才串連後端命令與資料庫。
