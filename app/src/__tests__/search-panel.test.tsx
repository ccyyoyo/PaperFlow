import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SearchPanel, SEARCH_DEBOUNCE_MS } from '../components/search-panel';
import { NoteCommands, SearchCommands } from '../ipc/commands';
import { useNotesStore } from '../state/notes-store';

const navigate = vi.fn();

vi.mock('react-router-dom', () => ({
  useNavigate: () => navigate
}));

vi.mock('../ipc/commands', () => ({
  SearchCommands: {
    query: vi.fn(),
    rebuild: vi.fn()
  },
  NoteCommands: {
    get: vi.fn()
  }
}));

const searchCommands = vi.mocked(SearchCommands);
const noteCommands = vi.mocked(NoteCommands);

describe('SearchPanel', () => {
  beforeEach(() => {
    searchCommands.query.mockReset();
    searchCommands.rebuild.mockReset();
    noteCommands.get.mockReset();
    navigate.mockReset();
    useNotesStore.setState({
      notes: [],
      isLoading: false,
      error: undefined,
      selectedNoteId: null
    });
  });

  it('performs a debounced search and renders results', async () => {
    const user = userEvent.setup();
    searchCommands.query.mockResolvedValue([
      { refType: 'note', refId: '1', snippet: 'Found <b>result</b>', score: 0.9 }
    ]);

    render(<SearchPanel />);

    await user.type(screen.getByPlaceholderText('Search notes or PDF content...'), 'result');

    await waitFor(() => expect(searchCommands.query).toHaveBeenCalledWith('result', 30), {
      timeout: SEARCH_DEBOUNCE_MS * 2
    });

    expect(await screen.findByText('Note')).toBeInTheDocument();
    expect(screen.getByText('#1 | 90%')).toBeInTheDocument();
    expect(screen.getByText(/Found/)).toBeInTheDocument();
  });
});
