type PreviewCardProps = {
  refId: string;
  snippet: string;
};

export function PreviewCard({ refId, snippet }: PreviewCardProps) {
  return (
    <div className="preview-card">
      <h3>Preview {refId}</h3>
      <p dangerouslySetInnerHTML={{ __html: snippet }} />
    </div>
  );
}
