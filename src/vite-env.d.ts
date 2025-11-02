/**
 * 檔案說明：
 * 專案的型別宣告補充，供 Vite 與 pdf.js 引入。
 */
/// <reference types="vite/client" />

declare module "*?url" {
  const value: string;
  export default value;
}

declare module "pdfjs-dist/web/pdf_viewer.mjs" {
  export function renderTextLayer(params: {
    textContent: any;
    container: HTMLElement;
    viewport: any;
    textDivs: HTMLElement[];
    textContentItemsStr?: string[];
  }): { promise: Promise<void> };
}

declare module "pdfjs-dist/web/pdf_viewer.css";
