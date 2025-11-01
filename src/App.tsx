import { useUiStore } from "./state/useUiStore";
import "./index.css";
import { PdfViewer } from "./components/PdfViewer";
import { NoteManagerPage } from "./components/NoteManager";
import { TaxonomyManager } from "./components/TaxonomyManager";
import { ToastContainer } from "./components/Toast";

export function App() {
  const activeTab = useUiStore((s) => s.activeTab);
  const setActiveTab = useUiStore((s) => s.setActiveTab);

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
          <button
            className={activeTab === "taxonomy" ? "app__tab app__tab--active" : "app__tab"}
            onClick={() => setActiveTab("taxonomy")}
            type="button"
          >
            分類管理
          </button>
        </nav>
        <p>
          {activeTab === "viewer"
            ? "選擇一個 PDF 檔案即可開始預覽。"
            : activeTab === "notes"
            ? "集中整理、篩選與瀏覽所有筆記（即將串接後端）。"
            : "管理顏色分類與標籤（自訂顏色、重新命名、刪除）"}
        </p>
      </header>
      {activeTab === "viewer" ? (
        <PdfViewer />
      ) : activeTab === "notes" ? (
        <NoteManagerPage />
      ) : (
        <TaxonomyManager />
      )}
      <ToastContainer />
    </main>
  );
}
