# 開發路線與待辦列表

## 階段概覽
| 階段 | 主要重點 | 狀態 |
| --- | --- | --- |
| MVP | PDF 閱讀、筆記基礎、搜尋骨架 | 開發中 |
| v1.1 | Workspace 管理、回顧儀表板 | TODO |
| v1.2 | Quick Flow 體驗優化、上下文預覽 | TODO |
| v2.0 | 效能與快取優化 | TODO |
| v3.0 | 選配雲端同步 / 協作 | TODO |

## MVP 待辦
- [x] 建立 Tauri + React 基礎殼
- [x] 透過 pdf.js canvas 顯示單一 PDF
- [ ] 支援 PDF 縮放
- [ ] 支援跳轉至指定頁面
- [ ] 儲存最近開啟的檔案列表
- [ ] 記錄最後閱讀頁面（本地儲存）
- [ ] 起草 SQLite 筆記 / 統計 schema
- [ ] Rust 實作基本筆記 CRUD（僅命令）
- [ ] React 側邊欄顯示每頁筆記清單
- [ ] 儲存筆記錨點（頁碼 + 座標）
- [ ] 將筆記內容寫入 FTS5 索引
- [ ] 提供搜尋命令回傳筆記結果
- [ ] 在 React 建立簡易搜尋面板
- [ ] 建立 Rust ↔ TS 共用型別（serde + TypeScript）
- [ ] 為核心 hook / component 撰寫 Vitest 測試
- [ ] 為 note manager 撰寫 Rust 單元測試
- [ ] 在 `docs/sdd/api_interface.md` 紀錄 API 指令

## 開發體驗
- [ ] 設定 ESLint + Prettier
- [ ] 加入 Husky pre-commit（lint / test）
- [ ] 架設 CI workflow（lint + build + test）
- [ ] 建立示範資料 / 範例檔
- [ ] 提供 `npm run storybook` 或 UI playground（可選）

## UX 強化
- [ ] PDF 載入骨架畫面
- [ ] 錯誤提示與重新整理按鈕
- [ ] 導覽快捷鍵（`J/K`, `Ctrl+G` 跳頁）
- [ ] 亮 / 暗色主題切換
- [ ] 視窗縮放時的響應式排版

## 文件
- [x] 架構總覽（英文 + 繁體）
- [ ] 技術藍圖詳細版
- [ ] 筆記資料流程圖
- [ ] 貢獻者速成指南
- [ ] FAQ：PDF 問題 / 筆記同步

## 效能與穩定（MVP 之後）
- [ ] 頁面縮圖 Lazy load
- [ ] 將渲染頁面快取至磁碟
- [ ] PDF 更新時偵測錨點漂移
- [ ] 背景重建全文索引
- [ ] 加入渲染計時（可選擇啟用）

## 延伸目標
- [ ] 雲端同步雛形（workspace 匯出 / 上傳）
- [ ] 協作提示（例如 ghost cursor）
- [ ] AI 協助摘要
- [ ] 行動裝置輕量閱讀器
