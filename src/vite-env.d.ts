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
