import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { NoteCommands, SearchCommands } from '../../ipc/commands';
import { SearchHit } from '../../types/search';
import { useNotesStore } from '../../state/notes-store';
import { useViewerStore } from '../../state/viewer-store';
import { PreviewCard } from '../preview-card';

export const SEARCH_DEBOUNCE_MS = 300;

export function SearchPanel() {
  const [term, setTerm] = useState('');
  const [pendingTerm, setPendingTerm] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [isNavigating, setIsNavigating] = useState(false);
  const navigate = useNavigate();
  const selectNote = useNotesStore((state) => state.selectNote);
  const requestViewer = useViewerStore((state) => state.requestView);

  useEffect(() => {
    const timer = setTimeout(() => {
      setTerm(pendingTerm.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [pendingTerm]);

  useEffect(() => {
    let cancelled = false;
    if (!term) {
      setResults([]);
      setError(undefined);
      return;
    }

    const runQuery = async () => {
      setIsLoading(true);
      setError(undefined);
      try {
        const hits = await SearchCommands.query(term, 30);
        if (!cancelled) {
          setResults(hits);
        }
      } catch (err) {
        console.error('Search failed', err);
        if (!cancelled) {
          setError('Search failed. Please try again.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void runQuery();
    return () => {
      cancelled = true;
    };
  }, [term]);

  const displayedResults = useMemo(
    () => results.slice().sort((a, b) => b.score - a.score),
    [results]
  );

  const rebuildIndex = async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      await SearchCommands.rebuild();
      if (term) {
        const hits = await SearchCommands.query(term, 30);
        setResults(hits);
      }
    } catch (err) {
      console.error('Failed to rebuild search index', err);
      setError('Index rebuild failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResultSelect = async (hit: SearchHit) => {
    if (isNavigating) {
      return;
    }
    setIsNavigating(true);
    setError(undefined);
    try {
      if (hit.refType === 'note') {
        const note = await NoteCommands.get(hit.refId);
        requestViewer({ paperId: note.paperId, page: note.page });
        selectNote(note.id);
        navigate(`/papers/${note.paperId}`);
      } else if (hit.refType === 'paper') {
        selectNote(null);
        navigate(`/papers/${hit.refId}`);
      } else {
        console.warn('Unhandled search result type', hit.refType);
      }
    } catch (err) {
      console.error('Failed to open search result', err);
      setError('Unable to open search result.');
    } finally {
      setIsNavigating(false);
    }
  };

  const getResultTitle = (hit: SearchHit) => {
    switch (hit.refType) {
      case 'note':
        return 'Note';
      case 'paper':
        return 'Paper';
      default:
        return hit.refType;
    }
  };

  const getResultMeta = (hit: SearchHit) => {
    const scorePercent = Number.isFinite(hit.score) ? Math.round(hit.score * 100) : 0;
    return `#${hit.refId} | ${scorePercent}%`;
  };

  return (
    <section className="search-panel">
      <header className="search-panel__header">
        <h2>Full-text search</h2>
        <button type="button" onClick={rebuildIndex} disabled={isLoading || isNavigating}>
          Rebuild index
        </button>
      </header>

      <input
        value={pendingTerm}
        onChange={(event) => setPendingTerm(event.target.value)}
        placeholder="Search notes or PDF content..."
      />

      {isLoading && <p className="search-status">Searching...</p>}
      {isNavigating && !isLoading && <p className="search-status">Opening result...</p>}
      {error && <p className="search-error">{error}</p>}

      {displayedResults.length === 0 && term && !isLoading && !error && (
        <p className="search-empty">No results matching "{term}".</p>
      )}

      {!term && !isLoading && <p className="search-hint">Type a keyword to start searching.</p>}

      <div className="search-results">
        {displayedResults.map((hit) => (
          <PreviewCard
            key={`${hit.refType}-${hit.refId}`}
            title={getResultTitle(hit)}
            meta={getResultMeta(hit)}
            snippet={hit.snippet ?? 'No snippet available.'}
            onSelect={() => {
              void handleResultSelect(hit);
            }}
            disabled={isNavigating || isLoading}
          />
        ))}
      </div>
    </section>
  );
}
