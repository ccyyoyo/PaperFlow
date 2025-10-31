import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';

import { NoteCommands } from '../../ipc/commands';
import { useNotesStore } from '../../state/notes-store';

type NoteEditorProps = {
  paperId: string;
  paperTitle?: string;
};

type FormState = {
  page: number;
  content: string;
  color: string;
};

const defaultForm: FormState = {
  page: 1,
  content: '',
  color: '#ffe08a'
};

export function NoteEditor({ paperId, paperTitle }: NoteEditorProps) {
  const notes = useNotesStore((state) => state.notes);
  const isLoading = useNotesStore((state) => state.isLoading);
  const storeError = useNotesStore((state) => state.error);
  const loadNotes = useNotesStore((state) => state.loadNotes);
  const upsertNote = useNotesStore((state) => state.upsertNote);
  const removeNote = useNotesStore((state) => state.removeNote);
  const setNotes = useNotesStore((state) => state.setNotes);
  const clearError = useNotesStore((state) => state.clearError);
  const selectedNoteId = useNotesStore((state) => state.selectedNoteId);
  const selectNote = useNotesStore((state) => state.selectNote);

  const [form, setForm] = useState<FormState>(defaultForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | undefined>();
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    if (!paperId) {
      setNotes([]);
      selectNote(null);
      return;
    }
    void loadNotes(paperId);
  }, [paperId, loadNotes, setNotes, selectNote]);

  useEffect(() => {
    setForm(defaultForm);
    setEditingNoteId(null);
    setActionError(undefined);
    selectNote(null);
  }, [paperId, selectNote]);

  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => a.page - b.page || a.createdAt.localeCompare(b.createdAt)),
    [notes]
  );

  useEffect(() => {
    if (!selectedNoteId) {
      return;
    }
    const listElement = listRef.current;
    if (!listElement) {
      return;
    }
    const target = listElement.querySelector<HTMLLIElement>(`[data-note-id="${selectedNoteId}"]`);
    if (target && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [selectedNoteId, sortedNotes]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!paperId || !form.content.trim()) {
      return;
    }

    setIsSubmitting(true);
    setActionError(undefined);

    try {
      if (editingNoteId) {
        const updated = await NoteCommands.update({
          id: editingNoteId,
          content: form.content.trim(),
          color: form.color.trim() || undefined
        });
        upsertNote(updated);
      } else {
        const created = await NoteCommands.create({
          paperId,
          page: Number.isFinite(form.page) ? Math.max(0, Math.floor(form.page)) : 0,
          x: 0,
          y: 0,
          content: form.content.trim(),
          color: form.color.trim() || undefined
        });
        upsertNote(created);
      }
      setForm(defaultForm);
      setEditingNoteId(null);
    } catch (err) {
      console.error('Failed to submit note', err);
      setActionError(editingNoteId ? 'Failed to update note' : 'Failed to create note');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (noteId: string) => {
    const note = notes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }
    setEditingNoteId(note.id);
    selectNote(note.id);
    setForm({
      page: note.page,
      content: note.content,
      color: note.color ?? ''
    });
  };

  const handleDelete = async (noteId: string) => {
    if (isSubmitting) {
      return;
    }
    setIsSubmitting(true);
    setActionError(undefined);
    try {
      await NoteCommands.remove(noteId);
      removeNote(noteId);
      if (editingNoteId === noteId) {
        setForm(defaultForm);
        setEditingNoteId(null);
      }
    } catch (err) {
      console.error('Failed to delete note', err);
      setActionError('Failed to delete note');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="note-editor">
      <header className="note-editor__header">
        <h2>Note Manager</h2>
        <span>Current paper: {(paperTitle ?? paperId) || 'Not selected'}</span>
      </header>

      {(storeError || actionError) && (
        <div className="note-editor__error" role="alert">
          <p>{actionError ?? storeError}</p>
          <button
            type="button"
            onClick={() => {
              clearError();
              setActionError(undefined);
            }}
          >
            Close
          </button>
        </div>
      )}

      <form className="note-editor__form" onSubmit={handleSubmit}>
        <label>
          Page
          <input
            type="number"
            min={0}
            value={form.page}
            onChange={(event) => setForm((state) => ({ ...state, page: Number(event.target.value) }))}
          />
        </label>
        <label>
          Color
          <input
            type="text"
            value={form.color}
            onChange={(event) => setForm((state) => ({ ...state, color: event.target.value }))}
            placeholder="#FFE08A"
          />
        </label>
        <label className="note-editor__content">
          Content
          <textarea
            rows={5}
            value={form.content}
            onChange={(event) => setForm((state) => ({ ...state, content: event.target.value }))}
            placeholder="Capture highlights, questions, or follow-up tasks..."
          />
        </label>
        <div className="note-editor__actions">
          <button type="submit" disabled={!paperId || !form.content.trim() || isSubmitting}>
            {editingNoteId ? 'Update note' : 'Create note'}
          </button>
          {editingNoteId && (
            <button
              type="button"
              onClick={() => {
                setForm(defaultForm);
                setEditingNoteId(null);
              }}
              disabled={isSubmitting}
            >
              Cancel edit
            </button>
          )}
        </div>
      </form>

      <div className="note-editor__list">
        <h3>Existing notes</h3>
        {isLoading && <p>Loading...</p>}
        {!isLoading && sortedNotes.length === 0 && <p>No notes yet. Create the first note!</p>}
        <ul ref={listRef}>
          {sortedNotes.map((note) => {
            const isSelected = note.id === selectedNoteId;
            const itemClassName = isSelected
              ? 'note-editor__item note-editor__item--selected'
              : 'note-editor__item';
            return (
              <li
                key={note.id}
                data-note-id={note.id}
                className={itemClassName}
                aria-selected={isSelected}
              >
              <header>
                <span>Page {note.page}</span>
                {note.color && <span className="note-color">{note.color}</span>}
              </header>
              <p>{note.content}</p>
              <footer>
                <small>Created at: {note.createdAt}</small>
                <div className="note-editor__item-actions">
                  <button type="button" onClick={() => handleEdit(note.id)} disabled={isSubmitting}>
                    Edit
                  </button>
                  <button type="button" onClick={() => void handleDelete(note.id)} disabled={isSubmitting}>
                    Delete
                  </button>
                </div>
              </footer>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
