import { useState } from "react";
import "./index.css";
import { PdfViewer } from "./components/PdfViewer";
import { NoteManagerPage } from "./components/NoteManager";

export function App() {
  const [activeTab, setActiveTab] = useState<"viewer" | "notes">("viewer");

  return (
    <main className="app">
      <header className="app__header">
        <h1>PaperFlow</h1>
        <nav className="app__tabs">
          <button
            className={activeTab === "viewer" ? "app__tab app__tab--active" : "app__tab"}
            onClick={() => setActiveTab("viewer")}
            type="button"
          >
            PDF 閱讀
          </button>
          <button
            className={activeTab === "notes" ? "app__tab app__tab--active" : "app__tab"}
            onClick={() => setActiveTab("notes")}
            type="button"
          >
            筆記管理
          </button>
        </nav>
        <p>
          {activeTab === "viewer"
            ? "選擇一個 PDF 檔案即可開始預覽。"
            : "集中整理、篩選與瀏覽所有筆記（即將串接後端）。"}
        </p>
      </header>
      {activeTab === "viewer" ? <PdfViewer /> : <NoteManagerPage />}
    </main>
  );
}
