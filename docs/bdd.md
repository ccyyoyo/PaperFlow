# PaperFlow BDD（Behavior-Driven Development）

以 Gherkin 敘述使用者價值與可驗收行為，串接 PRD 的體驗目標與自動化 E2E 測試。

---

## 1. 檔案與工具

- Feature 檔：`features/*.feature`
- 步驟定義：`features/step_definitions/*.ts`
- 執行：Cucumber.js（或等效），搭配 Playwright 駕馭 UI；標籤 `@wip @slow @e2e`。

---

## 2. 規範與風格

- 語言：中文為主，可混用英文技術名詞。
- 一個 Feature 聚焦單一價值；Scenario 使用「三段式」：Given / When / Then。
- 使用具體資料與可驗收的量測指標（如延遲門檻）。

---

## 3. 範例 Features

Feature: 匯入與開啟 PDF（Windows）

  作為研究者，我想把 PDF 匯入並快速開啟，
  如此我能立即開始閱讀與做筆記。

  Scenario: 匯入後 1 秒內可閱讀
    Given 我把 30MB 的 PDF 拖曳到 PaperFlow 視窗
    When 完成匯入並開啟該 Paper
    Then 我在 1 秒內看到第一頁渲染完成
    And 工具列可以操作跳頁與縮放

---

Feature: 選取文字建立筆記並高亮

  作為研究者，我想選取文字就能記筆記，
  如此不打斷閱讀節奏並能回到原段落。

  Scenario: 筆記建立延遲小於 50ms
    Given 我在 PDF 第 3 頁選取一段方法描述
    When 我按下 Ctrl+E 建立新筆記
    Then 筆記框在 50ms 內出現並聚焦
    And 該段落被高亮
    And 筆記儲存成功後可再次點擊跳回原段落

---

Feature: 全文搜尋（筆記與原文）

  作為研究者，我想一次搜尋所有內容，
  如此我能快速定位相關段落與筆記。

  Scenario: 搜尋前 20 筆在 150ms 內返回
    Given 我輸入關鍵字「對齊」
    When 我按下 Enter 進行搜尋
    Then 我在 150ms 內看到前 20 筆結果
    And 結果同時包含筆記與 PDF 段落
    And 點擊可直接跳轉到來源位置

---

Feature: 7 天回顧提醒

  作為研究者，我想定期回顧重要筆記，
  如此能累積並鞏固閱讀成果。

  Scenario: 7 天未回顧即提醒
    Given 我上週新增了 5 則筆記
    And 其中 2 則沒有被回顧
    When 我開啟 PaperFlow 的 Review 模式
    Then 我看到針對 2 則筆記的回顧提醒卡

---

## 4. 步驟定義建議（TS）

```ts
import { Given, When, Then } from '@cucumber/cucumber';
import { expect } from '@playwright/test';

Given('我把 {int}MB 的 PDF 拖曳到 PaperFlow 視窗', async function (sizeMB: number) {
  // TODO: 以 Playwright 模擬拖放或以選擇器挑檔
});

When('完成匯入並開啟該 Paper', async function () {
  // TODO: 監聽 UI 指示或 IPC 事件，等待渲染完成
});

Then('我在 {int} 秒內看到第一頁渲染完成', async function (sec: number) {
  // TODO: 量測啟動到可見的時間並斷言
});
```

---

## 5. 連結 PRD 驗收標準

- 時間門檻：開啟 < 1s、筆記 < 50ms、搜尋 < 150ms。
- 內容門檻：搜尋同時覆蓋筆記與 PDF 段落；點擊可跳轉；回顧提醒正確計數。

