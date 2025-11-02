/**
 * 筆記顏色類型：代表不同語意的高亮分類。
 */
export type NoteColor = "idea" | "method" | "result";

/**
 * 預設筆記顏色選項：每個類型對應顯示標籤與色票。
 */
export const NOTE_COLOR_OPTIONS: Record<NoteColor, { label: string; swatch: string }> = {
  idea: { label: "靈感", swatch: "#facc15" },
  method: { label: "方法", swatch: "#38bdf8" },
  result: { label: "結果", swatch: "#f472b6" },
};
