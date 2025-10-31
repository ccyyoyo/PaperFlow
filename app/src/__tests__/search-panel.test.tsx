import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SearchPanel, SEARCH_DEBOUNCE_MS } from '../components/search-panel';
import { SearchCommands } from '../ipc/commands';

describe('SearchPanel', () => {
  beforeEach(() => {
    SearchCommands.query.mockReset();
    SearchCommands.rebuild.mockReset();
  });

  it('performs a debounced search and renders results', async () => {
    vi.useFakeTimers();
    SearchCommands.query.mockResolvedValue([
      { ref_type: 'note', ref_id: '1', snippet: 'Found <b>result</b>', score: 0.9 }
    ]);

    try {
      render(<SearchPanel />);

      await userEvent.type(screen.getByPlaceholderText('Search notes or PDF content…'), 'result');

      await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);

      await waitFor(() => expect(SearchCommands.query).toHaveBeenCalledWith('result', 30));

      expect(await screen.findByText(/note #1/i)).toBeInTheDocument();
      expect(screen.getByText(/Found/)).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
