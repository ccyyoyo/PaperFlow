/**
 * 檔案說明：
 * 前端應用程式的入口檔，負責尋找根節點並掛載 React 應用。
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";

// DOM 根元素，作為 React 應用的掛載點
const target = document.getElementById("root");

// 若未找到根元素，立即中止並提示錯誤
if (!target) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(target).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
