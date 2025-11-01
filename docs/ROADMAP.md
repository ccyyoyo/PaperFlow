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
- [x] 支援 PDF 縮放
- [x] 支援跳轉至指定頁面
- [x] 儲存最近開啟的檔案列表
- [x] 記錄最後閱讀頁面（本地儲存）
- [x] 起草 SQLite 筆記 / 統計 schema
- [x] Rust 實作基本筆記 CRUD（僅命令）
- [ ] React 側邊欄顯示每頁筆記清單
- [ ] 儲存筆記錨點（頁碼 + 座標）
- [ ] 將筆記內容寫入 FTS5 索引
- [ ] 提供搜尋命令回傳筆記結果
- [ ] 在 React 建立簡易搜尋面板
- [ ] 建立 Rust ↔ TS 共用型別（serde + TypeScript）
- [ ] 為核心 hook / component 撰寫 Vitest 測試
- [ ] 為 note manager 撰寫 Rust 單元測試
- [ ] 在 `docs/sdd/api_interface.md` 紀錄 API 指令

### 筆記前端體驗
 - [x] PDF 選取文字後開啟筆記編輯器
- [ ] 筆記面板顯示頁碼、顏色、標籤
- [ ] 與 Tauri CRUD command 完整串接
- [ ] 確認儲存後重新整理仍能載入
- [ ] 錯誤提示（資料庫失敗、欄位檢查）
- [ ] 支援筆記刪除與文字更新（inline 編輯）

## 資料庫與後端
- [x] SQLite 初始化腳本
- [x] 基礎 CRUD Command
- [x] Migration 版本控管（schema_version）
- [ ] DB 模組單元／整合測試
- [ ] FTS5 匯入 PDF 文字與更新/刪除觸發器
- [ ] Transaction 與錯誤復原策略
- [ ] 工作區匯出備份（含資料庫檔＋附件）
- [ ] Stats 更新流程（閱讀時間、回顧次數）
- [ ] VACUUM / Analyze 維運腳本
- [ ] 資料庫連線池或重試策略（避免鎖表）
- [ ] DB 設定參數調校（journal_mode, synchronous）

## 開發體驗
- [ ] 設定 ESLint + Prettier
- [ ] 加入 Husky pre-commit（lint / test）
- [ ] 架設 CI workflow（lint + build + test）
- [ ] 建立示範資料 / 範例檔
- [ ] 提供 `npm run storybook` 或 UI playground（可選）
- [ ] CI 建立 Tauri bundle smoke test
- [ ] 自動化檔案格式化（Rust + TS）

## UX 強化
- [ ] PDF 載入骨架畫面
- [ ] 錯誤提示與重新整理按鈕
- [ ] 導覽快捷鍵（`J/K`, `Ctrl+G` 跳頁）
- [ ] 亮 / 暗色主題切換
- [ ] 視窗縮放時的響應式排版
- [ ] 快捷鍵教學 Tooltip / Modal
- [ ] 最近檔案管理（刪除、釘選）
- [ ] 筆記顏色/標籤篩選
- [ ] 查看筆記時同步高亮原文
- [ ] Quick Note 浮動視窗（Ctrl+Shift+Space）
- [ ] Command Palette 入口（Ctrl+K）
- [ ] Review Mode 空狀態與引導

## 搜尋與回顧
- [ ] 搜尋筆記 / PDF FTS5 API（支援 fuzziness）
- [ ] React 搜尋面板 UI
- [ ] 搜尋結果跳轉頁面與高亮
- [ ] Review Summary API（新增筆記數、標籤統計）
- [ ] Review Mode 介面（週報、提醒）
- [ ] 工作區提醒設定（週期、自訂標籤）

## 文件
- [x] 架構總覽（英文 + 繁體）
- [ ] 技術藍圖詳細版（Rust 模組、React 組件）
- [ ] 筆記資料流程圖（從選取文字到儲存）
- [ ] 貢獻者速成指南（專案架構、提交流程）
- [ ] FAQ：PDF 問題 / 筆記同步
- [ ] DB Migration 指南
- [ ] 開發與發佈 QA 清單
- [ ] 使用者操作手冊（截圖、流程）
- [ ] Troubleshooting 更新（PDF/DB 常見錯誤）

## 測試與品質
- [ ] Rust 側整合測試（命令 + SQLite）
- [ ] 前端 Vitest 覆蓋率報表
- [ ] Playwright / Tauri Driver 端對端腳本
- [ ] CI 失敗時輸出 DB log / 螢幕截圖
- [ ] 建立測試資料產生器（PDF + Notes fixtures）
- [ ] 靜態分析（Clippy / TypeScript lint）
- [ ] 定義測試資料夾結構與命名
- [ ] 覆蓋率門檻設定（Rust / TS）

## 效能與穩定（MVP 之後）
- [ ] 頁面縮圖 Lazy load
- [ ] 將渲染頁面快取至磁碟
- [ ] PDF 更新時偵測錨點漂移
- [ ] 背景重建全文索引
- [ ] 加入渲染計時（可選擇啟用）
- [ ] SQLite Vacuum 排程或使用者手動操作
- [ ] 分析大型工作區（>1GB PDF）性能
- [ ] 多執行緒索引重建
- [ ] 監測記憶體占用與改善策略

## 安全與維運
- [ ] 錯誤日誌輸出（檔案 + console）
- [ ] 異常狀況提示與回報管道
- [ ] 本地備份週期提醒
- [ ] 匯入檔案檢查（檔案大小、支援格式）
- [ ] 使用者資料匯出（刪除帳號、備份）
- [ ] 設定密碼 / 加密工作區（長期目標）

## 延伸目標
- [ ] 雲端同步雛形（workspace 匯出 / 上傳）
- [ ] 協作提示（例如 ghost cursor）
- [ ] AI 協助摘要
- [ ] 行動裝置輕量閱讀器
- [ ] 引入插件系統（例如自訂匯入器）
- [ ] 第三方資料庫同步（Notion / Obsidian）
- [ ] 文獻引用管理整合（Zotero / Mendeley）
- [ ] 自訂報表匯出（PDF / Markdown）
