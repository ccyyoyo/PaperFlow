import "./index.css";
import { PdfViewer } from "./components/PdfViewer";

export function App() {
  return (
    <main className="app">
      <header className="app__header">
        <h1>PaperFlow</h1>
        <p>選擇一個 PDF 檔案即可開始預覽。</p>
      </header>
      <PdfViewer />
    </main>
  );
}
