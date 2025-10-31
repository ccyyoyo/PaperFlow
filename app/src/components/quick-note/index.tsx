import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  isRegistered as isShortcutRegistered,
  register as registerShortcut,
  unregister as unregisterShortcut
} from '@tauri-apps/api/globalShortcut';

import { NoteCommands } from '../../ipc/commands';
import { useWorkspaceStore } from '../../state/workspace-store';
import { useNotesStore } from '../../state/notes-store';

const QUICK_NOTE_SHORTCUT = 'CommandOrControl+Shift+Space';
const SHORTCUT_LABEL = 'Ctrl + Shift + Space';

export function QuickNote() {
  const papers = useWorkspaceStore((state) => state.papers);
  const activeWorkspaceName = useWorkspaceStore((state) => {
    const workspace = state.workspaces.find((item) => item.id === state.activeWorkspaceId);
    return workspace?.name ?? state.activeWorkspaceId;
  });
  const upsertNote = useNotesStore((state) => state.upsertNote);

  const [paperId, setPaperId] = useState('');
  const [content, setContent] = useState('');
  const [page, setPage] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<string | undefined>();
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [shortcutReady, setShortcutReady] = useState(false);
  const [shortcutError, setShortcutError] = useState<string | undefined>();

  const overlayTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (papers.length > 0) {
      setPaperId((current) => current || papers[0].id);
    } else {
      setPaperId('');
    }
  }, [papers]);

  const openOverlay = useCallback(() => {
    setStatus(undefined);
    setIsOverlayOpen(true);
  }, []);

  const closeOverlay = useCallback(() => {
    setIsOverlayOpen(false);
  }, []);

  useEffect(() => {
    if (!isOverlayOpen) {
      return;
    }
    const textarea = overlayTextareaRef.current;
    if (textarea) {
      textarea.focus({ preventScroll: true });
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }, [isOverlayOpen, content]);

  useEffect(() => {
    if (!isOverlayOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeOverlay();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOverlayOpen, closeOverlay]);

  useEffect(() => {
    let disposed = false;

    const hasTauriContext = typeof window !== 'undefined' && typeof (window as unknown as Record<string, unknown>).__TAURI__ !== 'undefined';
    if (!hasTauriContext) {
      return () => undefined;
    }

    const setupShortcut = async () => {
      try {
        if (await isShortcutRegistered(QUICK_NOTE_SHORTCUT)) {
          await unregisterShortcut(QUICK_NOTE_SHORTCUT);
        }

        await registerShortcut(QUICK_NOTE_SHORTCUT, () => {
          if (!disposed) {
            openOverlay();
          }
        });

        if (!disposed) {
          setShortcutReady(true);
          setShortcutError(undefined);
        }
      } catch (err) {
        console.error('Failed to register quick note shortcut', err);
        if (!disposed) {
          setShortcutError('Shortcut unavailable in this build');
        }
      }
    };

    void setupShortcut();

    return () => {
      disposed = true;
      void unregisterShortcut(QUICK_NOTE_SHORTCUT).catch(() => undefined);
    };
  }, [openOverlay]);

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
      if (isOverlayOpen) {
        closeOverlay();
      }
    } catch (err) {
      console.error('Quick note failed', err);
      setStatus('Failed to create note. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const shortcutHint = useMemo(() => {
    if (shortcutError) {
      return `Shortcut: ${SHORTCUT_LABEL} (${shortcutError})`;
    }
    if (shortcutReady) {
      return `Shortcut: ${SHORTCUT_LABEL}`;
    }
    return `Shortcut: ${SHORTCUT_LABEL} (desktop app)`;
  }, [shortcutError, shortcutReady]);

  const renderForm = (mode: 'inline' | 'overlay') => {
    const formClassName =
      mode === 'overlay' ? 'quick-note__form quick-note__form--overlay' : 'quick-note__form';
    const showStatus =
      Boolean(status) &&
      ((mode === 'overlay' && isOverlayOpen) || (mode === 'inline' && !isOverlayOpen));
    return (
      <form className={formClassName} onSubmit={handleSubmit}>
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
            ref={mode === 'overlay' ? overlayTextareaRef : undefined}
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder={`Capture ideas in ${activeWorkspaceName}`}
            rows={mode === 'overlay' ? 6 : 4}
          />
        </label>
        <footer>
          <button type="submit" disabled={!paperId || !content.trim() || isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Create now'}
          </button>
          {mode === 'overlay' && (
            <button type="button" onClick={closeOverlay} disabled={isSubmitting}>
              Cancel
            </button>
          )}
          {showStatus && <span className="quick-note__status">{status}</span>}
        </footer>
      </form>
    );
  };

  return (
    <section className="quick-note">
      <header className="quick-note__header">
        <h2>Quick Note</h2>
        <div className="quick-note__actions">
          <span className="quick-note__hint">{shortcutHint}</span>
          <button type="button" onClick={openOverlay}>
            Open capture window
          </button>
        </div>
      </header>

      {renderForm('inline')}

      {isOverlayOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="quick-note-overlay" role="dialog" aria-modal="true">
            <div className="quick-note-overlay__backdrop" onClick={closeOverlay} />
            <div
              className="quick-note-overlay__panel"
              role="presentation"
              onClick={(event) => event.stopPropagation()}
            >
              <header className="quick-note-overlay__header">
                <h3>Quick capture</h3>
                <button
                  type="button"
                  onClick={closeOverlay}
                  aria-label="Close quick capture window"
                >
                  Close
                </button>
              </header>
              {renderForm('overlay')}
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}
