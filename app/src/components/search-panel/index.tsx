import { useEffect, useMemo, useState } from 'react';

import { SearchCommands } from '../../ipc/commands';
import { SearchHit } from '../../types/search';
import { PreviewCard } from '../preview-card';

export const SEARCH_DEBOUNCE_MS = 300;

export function SearchPanel() {
  const [term, setTerm] = useState('');
  const [pendingTerm, setPendingTerm] = useState('');
  const [results, setResults] = useState<SearchHit[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

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

  return (
    <section className="search-panel">
      <header className="search-panel__header">
        <h2>Full-text search</h2>
        <button type="button" onClick={rebuildIndex} disabled={isLoading}>
          Rebuild index
        </button>
      </header>

      <input
        value={pendingTerm}
        onChange={(event) => setPendingTerm(event.target.value)}
        placeholder="Search notes or PDF content…"
      />

      {isLoading && <p className="search-status">Searching…</p>}
      {error && <p className="search-error">{error}</p>}

      {displayedResults.length === 0 && term && !isLoading && !error && (
        <p className="search-empty">No results matching “{term}”.</p>
      )}

      {!term && !isLoading && <p className="search-hint">Type a keyword to start searching.</p>}

      <div className="search-results">
        {displayedResults.map((hit) => (
          <PreviewCard
            key={`${hit.ref_type}-${hit.ref_id}`}
            refId={`${hit.ref_type} #${hit.ref_id}`}
            snippet={hit.snippet ?? 'No snippet available.'}
          />
        ))}
      </div>
    </section>
  );
}
