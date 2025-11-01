import { useEffect, useMemo, useState } from "react";
import { NOTE_COLOR_OPTIONS, NoteColor } from "./noteColors";
import "./noteManager.css";
import { useViewerStore } from "../state/useViewerStore";
import { useNotesStore, type Note as StoreNote } from "../state/useNotesStore";
import { invoke } from "@tauri-apps/api/tauri";
import { useUiStore } from "../state/useUiStore";
import { useTaxonomyStore } from "../state/useTaxonomyStore";

export function NoteManagerPage() {
  const currentPdf = useViewerStore((s) => s.currentPdf);
  const setViewState = useViewerStore((s) => s.setViewState);
  const flashJumpAnchor = useViewerStore((s) => s.flashJumpAnchor);
  const notes = useNotesStore((s) =>
    currentPdf ? s.getNotes(currentPdf.id) : []
  );
  const setNotes = useNotesStore((s) => s.setNotes);
  const upsertNote = useNotesStore((s) => s.upsertNote);
  const deleteNoteInStore = useNotesStore((s) => s.deleteNote);
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const taxonomyColors = useTaxonomyStore((s) => s.colors);
  const colorOptions = useMemo(() => {
    const entries = Object.keys(taxonomyColors ?? {}).length
      ? taxonomyColors
      : Object.fromEntries(
          Object.entries(NOTE_COLOR_OPTIONS).map(([id, v]) => [id, { id, label: v.label, swatch: v.swatch }])
        );
    return entries as Record<string, { id: string; label: string; swatch: string }>;
  }, [taxonomyColors]);
  const [colorFilter, setColorFilter] = useState<string | "all">("all");
  const [keyword, setKeyword] = useState("");
  const [pageFilter, setPageFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<"page" | "updatedAt">("updatedAt");
  const [filtersOpen, setFiltersOpen] = useState(true);

  const isTauriRuntime =
    typeof window !== "undefined" && Boolean((window as any).__TAURI_IPC__);

  useEffect(() => {
    const load = async () => {
      if (!isTauriRuntime || !currentPdf?.id || !currentPdf.path) return;
      try {
        const backendNotes = await invoke<any>("list_notes_command", {
          paperId: currentPdf.id,
        });
        if (Array.isArray(backendNotes)) {
          const mapped = backendNotes.map((n: any) => ({
            id: String(n.id),
            pdfId: String(n.paperId ?? currentPdf.id),
            page: Number(n.page ?? 1),
            content: String(n.content ?? ""),
            color: (n.color ?? "idea") as NoteColor,
            tags: String(n.tags ?? "")
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
            updatedAt: String(n.updatedAt ?? new Date().toISOString()),
            anchor: { x: Number(n.x ?? 0), y: Number(n.y ?? 0) },
          }));
          setNotes(currentPdf.id, mapped);
        }
      } catch (e) {
        console.warn("Failed to list notes", e);
      }
    };
    load();
  }, [currentPdf?.id, currentPdf?.path, isTauriRuntime, setNotes]);

  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      if (colorFilter !== "all" && note.color !== (colorFilter as any)) return false;
      if (pageFilter) {
        const pageNumber = Number(pageFilter);
        if (!Number.isNaN(pageNumber) && note.page !== pageNumber) return false;
      }
      if (keyword) {
        const lower = keyword.toLowerCase();
        const hitContent = note.content.toLowerCase().includes(lower);
        const hitTags = note.tags.some((tag) => tag.toLowerCase().includes(lower));
        if (!hitContent && !hitTags) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortKey === "page") {
        return a.page - b.page;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [colorFilter, keyword, pageFilter, sortKey, notes]);

  return (
    <section className="note-manager ui-card ui-section">
      <header className="note-manager__header">
        <div>
          <h1>筆記管理</h1>
          <p>
            {currentPdf
              ? `目前檔案：${currentPdf.name}（共 ${currentPdf.totalPages} 頁）`
              : "請先在 PDF 閱讀頁選擇檔案，新增的筆記會顯示在此。"}
          </p>
        </div>
        <div className={filtersOpen ? "note-manager__filters" : "note-manager__filters note-manager__filters--closed"}>
          <div className="note-manager__filters-top">
            <strong>篩選</strong>
            <button type="button" className="ui-button ui-button--ghost" onClick={() => setFiltersOpen((v) => !v)}>
              {filtersOpen ? "收合" : "展開"}
            </button>
          </div>
          <div className="note-manager__controls">
          <div className="note-manager__filter">
            <span className="note-manager__filter-label">顏色</span>
            <div className="note-manager__chips">
              <button
                type="button"
                className={`note-manager__chip ${colorFilter === "all" ? "note-manager__chip--active" : ""}`}
                onClick={() => setColorFilter("all")}
              >
                全部
              </button>
              {Object.keys(colorOptions).map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`note-manager__chip ${colorFilter === key ? "note-manager__chip--active" : ""}`}
                  onClick={() => setColorFilter(key)}
                  title={colorOptions[key].label}
                >
                  <span
                    className="note-manager__chip-swatch"
                    style={{ background: colorOptions[key].swatch }}
                  />
                  {colorOptions[key].label}
                </button>
              ))}
            </div>
          </div>
          <label>
            頁碼
            <input
              value={pageFilter}
              onChange={(event) => setPageFilter(event.target.value)}
              inputMode="numeric"
              placeholder="例如 3"
            />
          </label>
          <label>
            搜尋
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="內容或標籤"
            />
          </label>
          <label>
            排序
            <select value={sortKey} onChange={(event) => setSortKey(event.target.value as "page" | "updatedAt")}> 
              <option value="updatedAt">最後更新時間</option>
              <option value="page">頁碼</option>
            </select>
          </label>
          </div>
        </div>
      </header>

      <hr className="ui-divider" />
      <ul className="note-manager__list">
        {filteredNotes.map((note) => (
          <NoteRow
            key={note.id}
            note={note}
            onJump={() => {
              setViewState({ page: note.page });
              if (note.anchor) {
                flashJumpAnchor(note.anchor);
              }
              setActiveTab("viewer");
            }}
            onUpdate={async (patch) => {
              const next = { ...note, ...patch };
              if (isTauriRuntime && currentPdf?.id) {
                try {
                  const updated = await invoke<any>("update_note_command", {
                    payload: {
                      id: note.id,
                      content: next.content,
                      color: next.color,
                      tags: next.tags.join(","),
                    },
                  });
                  const mapped = {
                    id: String(updated.id ?? note.id),
                    pdfId: currentPdf.id,
                    page: Number(updated.page ?? note.page),
                    content: String(updated.content ?? next.content),
                    color: (updated.color ?? next.color) as NoteColor,
                    tags: String(updated.tags ?? next.tags.join(","))
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean),
                    updatedAt: String(updated.updatedAt ?? new Date().toISOString()),
                    anchor: { x: Number(updated.x ?? 0), y: Number(updated.y ?? 0) },
                  };
                  upsertNote(currentPdf.id, mapped);
                  const { useToast } = await import("../state/useToast");
                  useToast.getState().show("success", "筆記已更新");
                } catch (e) {
                  console.warn("Failed to update note", e);
                  const { useToast } = await import("../state/useToast");
                  useToast.getState().show("error", "更新失敗");
                }
              } else {
                upsertNote(note.pdfId, next as any);
                const { useToast } = await import("../state/useToast");
                useToast.getState().show("success", "筆記已更新（本機）");
              }
            }}
            onDelete={async () => {
              if (isTauriRuntime && currentPdf?.id) {
                try {
                  await invoke("delete_note_command", { noteId: note.id });
                  deleteNoteInStore(currentPdf.id, note.id);
                  const { useToast } = await import("../state/useToast");
                  useToast.getState().show("success", "筆記已刪除");
                } catch (e) {
                  console.warn("Failed to delete note", e);
                  const { useToast } = await import("../state/useToast");
                  useToast.getState().show("error", "刪除失敗");
                }
              } else {
                deleteNoteInStore(note.pdfId, note.id);
                const { useToast } = await import("../state/useToast");
                useToast.getState().show("success", "筆記已刪除（本機）");
              }
            }}
          />
        ))}
      </ul>
    </section>
  );
}

type RowProps = {
  note: StoreNote;
  onJump: () => void;
  onUpdate: (patch: { content: string; color: NoteColor; tags: string[] }) => Promise<void> | void;
  onDelete: () => Promise<void> | void;
};

function NoteRow({ note, onJump, onUpdate, onDelete }: RowProps) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [color, setColor] = useState<NoteColor>(note.color);
  const [tags, setTags] = useState<string[]>(note.tags);
  const [tagInput, setTagInput] = useState("");
  const taxonomyColors = useTaxonomyStore((s) => s.colors);
  const colorOptions = useMemo(() => {
    const entries = Object.keys(taxonomyColors ?? {}).length
      ? taxonomyColors
      : Object.fromEntries(
          Object.entries(NOTE_COLOR_OPTIONS).map(([id, v]) => [id, { id, label: v.label, swatch: v.swatch }])
        );
    return entries as Record<string, { id: string; label: string; swatch: string }>;
  }, [taxonomyColors]);

  const handleSave = async () => {
    await onUpdate({
      content,
      color,
      tags,
    });
    setEditing(false);
  };

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const value = tagInput.trim();
      if (value && !tags.includes(value)) {
        setTags([...tags, value]);
      }
      setTagInput("");
    } else if (e.key === "Backspace" && tagInput === "") {
      setTags((prev) => prev.slice(0, -1));
    }
  };

  return (
    <li
      className={`note-manager__item note-manager__item--${note.color} ui-card`}
      style={{ borderLeft: `4px solid ${colorOptions[note.color]?.swatch || "#6b7280"}` }}
      onDoubleClick={onJump}
      title="雙擊跳至此筆記的位置"
    >
      <header>
        <span className="note-manager__item-page">第 {note.page} 頁</span>
        <span className="note-manager__item-meta">
          {new Date(note.updatedAt).toLocaleString()}
        </span>
      </header>
      {editing ? (
        <div className="note-manager__item-content">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
          />
        </div>
      ) : (
        <p className="note-manager__item-content">{note.content}</p>
      )}
      {editing ? (
        <div className="note-manager__tags-editor">
          <div className="note-manager__tags-input">
            {tags.map((t) => (
              <span key={t} className="note-manager__tag">
                {t}
                <button
                  type="button"
                  className="note-manager__tag-remove"
                  onClick={() => setTags(tags.filter((x) => x !== t))}
                  aria-label={`移除標籤 ${t}`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              placeholder={tags.length === 0 ? "輸入後按 Enter" : "新增標籤"}
            />
          </div>
        </div>
      ) : (
        <div className="note-manager__item-tags">
          {note.tags.map((tag: string) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      )}
      <footer>
        <span className="note-manager__item-color">
          {editing ? (
            <div className="note-manager__color-options">
              {Object.keys(colorOptions).map((key) => {
                const opt = colorOptions[key];
                const active = color === key;
                return (
                  <button
                    key={key}
                    type="button"
                    className={`note-manager__color-btn ${
                      active ? "note-manager__color-btn--active" : ""
                    }`}
                    onClick={() => setColor(key as NoteColor)}
                    title={opt.label}
                  >
                    <span
                      className="note-manager__color-swatch"
                      style={{ background: opt.swatch }}
                    />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <span className="note-manager__item-color-visual">
              <span
                className="note-manager__item-color-swatch"
                style={{ background: colorOptions[note.color]?.swatch || "#6b7280" }}
              />
              {colorOptions[note.color]?.label ?? note.color}
            </span>
          )}
        </span>
        {editing ? (
          <>
            <button type="button" className="note-manager__item-button ui-button ui-button--primary" onClick={handleSave}>
              儲存
            </button>
            <button
              type="button"
              className="note-manager__item-button ui-button ui-button--ghost"
              onClick={() => {
                setEditing(false);
                setContent(note.content);
                setColor(note.color);
                setTags(note.tags);
                setTagInput("");
              }}
            >
              取消
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="note-manager__item-button ui-button ui-button--ghost"
              onClick={() => setEditing(true)}
            >
              編輯
            </button>
            <button
              type="button"
              className="note-manager__item-button note-manager__item-button--danger ui-button ui-button--danger"
              onClick={() => {
                if (window.confirm("確定要刪除此筆記嗎？此動作無法復原。")) {
                  onDelete();
                }
              }}
            >
              刪除
            </button>
          </>
        )}
      </footer>
    </li>
  );
}
