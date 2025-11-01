export type NoteColor = "idea" | "method" | "result";

export const NOTE_COLOR_OPTIONS: Record<NoteColor, { label: string; swatch: string }> = {
  idea: { label: "靈感", swatch: "#facc15" },
  method: { label: "方法", swatch: "#38bdf8" },
  result: { label: "結果", swatch: "#f472b6" },
};
