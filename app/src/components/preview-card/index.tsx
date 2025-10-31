type PreviewCardProps = {
  title: string;
  meta?: string;
  snippet: string;
  onSelect?: () => void;
  disabled?: boolean;
};

export function PreviewCard({ title, meta, snippet, onSelect, disabled }: PreviewCardProps) {
  return (
    <button
      type="button"
      className="preview-card"
      onClick={onSelect}
      disabled={disabled}
    >
      <header className="preview-card__header">
        <span className="preview-card__title">{title}</span>
        {meta && <span className="preview-card__meta">{meta}</span>}
      </header>
      <p className="preview-card__snippet" dangerouslySetInnerHTML={{ __html: snippet }} />
    </button>
  );
}
