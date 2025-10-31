import { useEffect, useState } from 'react';

import { ReviewCommands } from '../ipc/commands';

type ReviewSummary = {
  notes_to_review: number;
  total_read_time: number;
};

export function ReviewDashboard() {
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const loadSummary = async () => {
    setIsLoading(true);
    setError(undefined);
    try {
      const result = await ReviewCommands.summary();
      setSummary(result);
    } catch (err) {
      console.error('Failed to load review summary', err);
      setError('Unable to fetch review stats.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadSummary();
  }, []);

  return (
    <section className="review-dashboard">
      <header>
        <h2>Review dashboard</h2>
        <button type="button" onClick={loadSummary} disabled={isLoading}>
          {isLoading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {error && <p className="review-dashboard__error">{error}</p>}

      {summary && (
        <ul>
          <li>Notes queued for review: {summary.notes_to_review}</li>
          <li>Total reading time: {Math.round(summary.total_read_time / 60)} minutes</li>
          <li>Daily trend: {summary.total_read_time === 0 ? 'Start today!' : 'On track'}</li>
        </ul>
      )}

      {!summary && !isLoading && !error && <p>No review data yet. Create some notes to get started.</p>}
    </section>
  );
}
