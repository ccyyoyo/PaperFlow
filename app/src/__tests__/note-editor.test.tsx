import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { NoteEditor } from '../components/note-editor';
import { useNotesStore } from '../state/notes-store';
import { NoteCommands } from '../ipc/commands';

vi.mock('../ipc/commands', () => ({
  NoteCommands: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
  }
}));

const noteCommands = vi.mocked(NoteCommands);

const exampleNote = {
  id: 'note-1',
  paperId: 'paper-1',
  page: 1,
  x: 0,
  y: 0,
  content: 'Initial note',
  color: '#ffe08a',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z'
};

describe('NoteEditor', () => {
  beforeEach(() => {
    useNotesStore.setState({
      notes: [],
      isLoading: false,
      error: undefined
    });
    noteCommands.list.mockReset();
    noteCommands.create.mockReset();
    noteCommands.update.mockReset();
    noteCommands.remove.mockReset();
  });

  it('loads notes on mount and shows empty message', async () => {
    noteCommands.list.mockResolvedValue([]);

    render(<NoteEditor paperId="paper-1" paperTitle="Paper One" />);

    await waitFor(() => expect(noteCommands.list).toHaveBeenCalledWith('paper-1'));
    expect(await screen.findByText('No notes yet. Create the first note!')).toBeInTheDocument();
  });

  it('creates a new note and updates the list', async () => {
    noteCommands.list.mockResolvedValue([]);
    noteCommands.create.mockResolvedValue({
      ...exampleNote,
      content: 'New insight',
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z'
    });

    render(<NoteEditor paperId="paper-1" paperTitle="Paper One" />);

    await waitFor(() => expect(NoteCommands.list).toHaveBeenCalled());

    await userEvent.type(screen.getByLabelText('Content'), 'New insight');
    await userEvent.clear(screen.getByLabelText('Page'));
    await userEvent.type(screen.getByLabelText('Page'), '2');

    await userEvent.click(screen.getByRole('button', { name: 'Create note' }));

    await waitFor(() => expect(noteCommands.create).toHaveBeenCalled());
    expect(noteCommands.create).toHaveBeenCalledWith({
      paperId: 'paper-1',
      page: 2,
      x: 0,
      y: 0,
      content: 'New insight',
      color: '#ffe08a'
    });

    expect(await screen.findByText('New insight')).toBeInTheDocument();
  });
});
