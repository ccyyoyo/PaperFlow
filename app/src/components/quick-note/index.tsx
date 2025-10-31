import { FormEvent, useEffect, useState } from 'react';

import { NoteCommands } from '../../ipc/commands';
import { useWorkspaceStore } from '../../state/workspace-store';
import { useNotesStore } from '../../state/notes-store';

export function QuickNote() {
  const papers = useWorkspaceStore((state) => state.papers);
  const defaultWorkspace = useWorkspaceStore((state) => state.activeWorkspaceId);
  const upsertNote = useNotesStore((state) => state.upsertNote);

  const [paperId, setPaperId] = useState('');
  const [content, setContent] = useState('');
  const [page, setPage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | undefined>();

  useEffect(() => {
    if (papers.length > 0) {
      setPaperId((current) => current || papers[0].id);
    } else {
      setPaperId('');
    }
  }, [papers]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!paperId || !content.trim()) {
      return;
    }
    setIsSubmitting(true);
    setStatus(undefined);
    try {
      const created = await NoteCommands.create({
        paperId,
        page: Math.max(0, Math.floor(page)),
        x: 0,
        y: 0,
        content: content.trim(),
        color: undefined
      });
      upsertNote(created);
      setContent('');
      setStatus('Note created!');
    } catch (err) {
      console.error('Quick note failed', err);
      setStatus('Failed to create note. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="quick-note">
      <header>
        <h2>Quick Note</h2>
        <span className="quick-note__hint">Shortcut: Ctrl + Shift + Space</span>
      </header>

      <form onSubmit={handleSubmit}>
        <label>
          Target paper
          <select value={paperId} onChange={(event) => setPaperId(event.target.value)}>
            {papers.length === 0 && <option value="">No PDFs imported</option>}
            {papers.map((paper) => (
              <option key={paper.id} value={paper.id}>
                {paper.title || paper.path}
              </option>
            ))}
          </select>
        </label>
        <label>
          Page
          <input
            type="number"
            min={0}
            value={page}
            onChange={(event) => setPage(Number(event.target.value))}
          />
        </label>
        <label>
          Content
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={`Capture ideas in ${defaultWorkspace}`}
            rows={4}
          />
        </label>
        <footer>
          <button type="submit" disabled={!paperId || !content.trim() || isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Create now'}
          </button>
          {status && <span className="quick-note__status">{status}</span>}
        </footer>
      </form>
    </section>
  );
}
