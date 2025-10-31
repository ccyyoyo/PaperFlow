# PaperFlow (Tauri Edition)

PaperFlow 是一款專為研究者打造的「筆記導向 PDF 閱讀器」，目前以 Windows 10/11 (x64) 為目標平台，聚焦於流暢閱讀、快速筆記與高效率回顧。專案以 Tauri (Rust) + React + pdf.js + SQLite/FTS5 打造，並依循 docs/ 內的 PRD、SDD、DDD、TDD、BDD 規畫。

## 核心特色

- **Workspace 管理**：依研究主題整理多篇 Paper、筆記與回顧摘要。
- **智慧筆記**：選取文字即彈出筆記框，筆記與段落錨點同步，高亮不漂移。
- **Quick Flow**：提供全域/應用層快捷鍵 (`Ctrl+E`, `Ctrl+K`, `Ctrl+Shift+Space`) 及 Quick Note 小窗。
- **全文搜尋**：SQLite FTS5 + CJK 分詞，一次檢索 PDF 原文與筆記內容。
- **回顧與統計**：每週報告、回顧提醒、閱讀時間追蹤。
- **Windows 最佳化**：支援 WebView2、高 DPI、多螢幕、中文與長路徑。

## 技術棧

- **桌面框架**：Tauri (Rust)
- **前端**：React + Vite + TypeScript，配合 Zustand/Jotai、TipTap (預計導入)、pdf.js
- **資料庫**：SQLite + FTS5，schema 版本化遷移
- **狀態與溝通**：IPC Commands/Events + React store，Zod 驗證 payload
- **測試建議**：Vitest、Playwright、Rust 單元/整合測試 (詳見 docs/tdd.md)

## 專案結構

```text
PaperFlow/
├─ docs/                    # PRD、SDD、DDD、TDD、BDD、技術藍圖
├─ src-tauri/               # Rust (Tauri) 後端
│  ├─ migrations/           # SQLite schema 遷移腳本
│  └─ src/
│     ├─ commands/          # IPC 命令 (薄層)
│     ├─ services/          # DB/搜尋/錨點/設定等服務
│     ├─ domain/            # 共用資料模型
│     ├─ telemetry/         # 日誌與錯誤
│     └─ utils/             # 工具程式
├─ app/                     # React + Vite 前端
│  ├─ public/
│  └─ src/
│     ├─ components/        # UI 元件 (PDF viewer、筆記、搜尋等)
│     ├─ routes/            # 頁面路由
│     ├─ ipc/               # IPC 包裝與 Schema
│     ├─ state/             # Zustand store
│     ├─ types/             # TS 型別 (與 Rust 對應)
│     └─ styles/            # 全域樣式
├─ pnpm-workspace.yaml      # pnpm 工作區設定
├─ .gitignore
└─ README.md
```

## 環境需求

- Windows 10/11 (x64)
- Node.js 18+ 與 pnpm 8+
- Rust 1.74+、cargo、Tauri prerequisites (VS Build Tools、WebView2 Runtime)
- SQLite (已隨 rusqlite bundled feature 打包)

詳細相依與平台限制請參考 `docs/technical-blueprint.md`。

## 快速開始

```bash
# 安裝前端相依
pnpm install --filter app

# 安裝 Tauri CLI (首次)
pnpm install --global @tauri-apps/cli

# 同步安裝 Rust 相依 (可選)
cargo fetch --manifest-path src-tauri/Cargo.toml

# 啟動前端開發伺服器 (由 Tauri 設定自動呼叫)
pnpm --dir app dev

# 使用 Tauri 啟動整體應用
pnpm tauri dev
```

> 若僅啟動 Tauri：`pnpm tauri dev` 會執行 `pnpm --dir app dev` 作為前端。首次執行需確保 WebView2 Runtime 已安裝。

## 開發指令

- `pnpm --dir app build`：前端產生 production bundle
- `cargo fmt && cargo clippy`：格式化並靜態檢查 Rust 程式
- `cargo check`：驗證 Tauri 專案是否能編譯
- `pnpm tauri build`：產出 Windows 安裝包 (NSIS/MSI)

## 測試 (依 docs/tdd.md 建議)

```bash
# React 單元測試
pnpm --dir app test

# Rust 單元/整合測試
cargo test --manifest-path src-tauri/Cargo.toml

# E2E 測試 (待 Playwright/Cucumber 腳手架完成)
pnpm --dir app test:e2e
```

## 文件索引

- `docs/prd.md`：產品需求文件 (PRD)
- `docs/sdd.md`：軟體設計文件 (SDD)
- `docs/ddd.md`：領域驅動設計 (DDD)
- `docs/tdd.md`：測試指南 (TDD)
- `docs/bdd.md`：行為驅動設計 (BDD)
- `docs/technical-blueprint.md`：技術藍圖、模組架構與 IPC 定義

## 授權

本專案採用 [MIT](LICENSE) 授權。歡迎依據文件與藍圖貢獻實作、測試與最佳化。
