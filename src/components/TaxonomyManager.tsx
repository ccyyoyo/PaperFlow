import { useMemo, useState } from "react";
import { useTaxonomyStore } from "../state/useTaxonomyStore";
import { useUiStore } from "../state/useUiStore";
import "./taxonomyManager.css";

export function TaxonomyManager() {
  const { colors, tags, addColor, updateColor, deleteColor, addTag, updateTag, deleteTag } =
    useTaxonomyStore();
  const colorList = useMemo(() => Object.values(colors), [colors]);
  const [newColorLabel, setNewColorLabel] = useState("");
  const [newColorSwatch, setNewColorSwatch] = useState("#8b5cf6");
  const SUGGESTED = ["#f43f5e", "#fb923c", "#facc15", "#22c55e", "#38bdf8", "#a78bfa", "#f472b6", "#94a3b8"];

  const [newTag, setNewTag] = useState("");
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingTagValue, setEditingTagValue] = useState("");

  const setActiveTab = useUiStore((s) => s.setActiveTab);

  return (
    <section className="taxonomy ui-card ui-section">
      <header className="taxonomy__header">
        <div>
          <h1>分類管理</h1>
          <p>新增、編輯或刪除顏色分類與標籤。</p>
        </div>
        <div className="taxonomy__actions">
          <button type="button" className="taxonomy__button ui-button ui-button--ghost" onClick={() => setActiveTab("viewer")}>返回閱讀</button>
        </div>
      </header>

      <section className="taxonomy__section">
        <h2>顏色分類</h2>
        <div className="taxonomy__new">
          <input
            value={newColorLabel}
            onChange={(e) => setNewColorLabel(e.target.value)}
            placeholder="顏色名稱（例如 重點）"
          />
          <input
            type="color"
            value={newColorSwatch}
            onChange={(e) => setNewColorSwatch(e.target.value)}
          />
          <div className="taxonomy__palette">
            {SUGGESTED.map((hex) => (
              <button
                key={hex}
                type="button"
                className="taxonomy__swatch"
                style={{ background: hex }}
                onClick={() => setNewColorSwatch(hex)}
                title={hex}
              />
            ))}
          </div>
          <button
            type="button"
            className="taxonomy__button ui-button ui-button--primary"
            onClick={() => {
              const label = newColorLabel.trim();
              if (!label) return;
              addColor(label, newColorSwatch);
              setNewColorLabel("");
              import("../state/useToast").then(({ useToast }) => useToast.getState().show("success", "已新增顏色分類"));
            }}
          >
            新增顏色
          </button>
        </div>

        <ul className="taxonomy__grid">
          {colorList.map((cat) => (
            <li
              key={cat.id}
              className="taxonomy__color-card"
              style={{ ["--cat-color" as any]: cat.swatch }}
            >
              <div className="taxonomy__color-head">
                <span
                  className="taxonomy__swatch-large"
                  style={{ background: cat.swatch }}
                  title={cat.label}
                />
                <div className="taxonomy__color-meta">
                  <input
                    className="taxonomy__inline-input"
                    value={cat.label}
                    onChange={(e) => updateColor(cat.id, { label: e.target.value })}
                    placeholder="顏色名稱"
                  />
                  <span className="taxonomy__color-id">{cat.id}</span>
                </div>
                <input
                  className="taxonomy__color-picker"
                  type="color"
                  value={cat.swatch}
                  onChange={(e) => updateColor(cat.id, { swatch: e.target.value })}
                  title="選擇顏色"
                />
              </div>
              <div className="taxonomy__color-foot">
                <span className="taxonomy__hex">{cat.swatch}</span>
                <div className="taxonomy__row-actions">
                  <button
                    type="button"
                    className="taxonomy__button taxonomy__button--danger ui-button ui-button--danger"
                    onClick={() => {
                      if (window.confirm(`確定刪除顏色分類「${cat.label}」？`)) {
                        deleteColor(cat.id);
                        import("../state/useToast").then(({ useToast }) =>
                          useToast.getState().show("success", "已刪除顏色分類")
                        );
                      }
                    }}
                  >
                    刪除
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <hr className="ui-divider" />
      <section className="taxonomy__section">
        <h2>標籤</h2>
        <div className="taxonomy__new">
          <input
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            placeholder="輸入標籤後按新增"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const v = newTag.trim();
                if (!v) return;
                addTag(v);
                setNewTag("");
              }
            }}
          />
          <button
            type="button"
            className="taxonomy__button ui-button ui-button--primary"
            onClick={() => {
              const v = newTag.trim();
              if (!v) return;
              addTag(v);
              setNewTag("");
              import("../state/useToast").then(({ useToast }) => useToast.getState().show("success", "已新增標籤"));
            }}
          >
            新增標籤
          </button>
        </div>

        <ul className="taxonomy__list">
          {tags.map((tag) => (
            <li key={tag} className="taxonomy__item">
              <div className="taxonomy__tag">
                {editingTag === tag ? (
                  <input
                    autoFocus
                    value={editingTagValue}
                    onChange={(e) => setEditingTagValue(e.target.value)}
                    onBlur={() => {
                      const next = editingTagValue.trim();
                      if (next && next !== tag) updateTag(tag, next);
                      setEditingTag(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const next = editingTagValue.trim();
                        if (next && next !== tag) updateTag(tag, next);
                        setEditingTag(null);
                      } else if (e.key === "Escape") {
                        setEditingTag(null);
                      }
                    }}
                  />
                ) : (
                  <span>{tag}</span>
                )}
              </div>
              <div className="taxonomy__row-actions">
                {editingTag === tag ? (
                  <button
                    type="button"
                    className="taxonomy__button ui-button ui-button--primary"
                    onClick={() => {
                      const next = editingTagValue.trim();
                      if (next && next !== tag) updateTag(tag, next);
                      setEditingTag(null);
                      import("../state/useToast").then(({ useToast }) => useToast.getState().show("success", "標籤已重新命名"));
                    }}
                  >
                    儲存
                  </button>
                ) : (
                  <button
                    type="button"
                    className="taxonomy__button ui-button ui-button--ghost"
                    onClick={() => {
                      setEditingTag(tag);
                      setEditingTagValue(tag);
                    }}
                  >
                    重新命名
                  </button>
                )}
                <button
                  type="button"
                  className="taxonomy__button taxonomy__button--danger ui-button ui-button--danger"
                  onClick={() => {
                    if (window.confirm(`確定刪除標籤「${tag}」？`)) {
                      deleteTag(tag);
                      import("../state/useToast").then(({ useToast }) => useToast.getState().show("success", "已刪除標籤"));
                    }
                  }}
                >
                  刪除
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
