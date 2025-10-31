import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

vi.mock('./src/ipc/commands', () => {
  const PaperCommands = {
    list: vi.fn(),
    open: vi.fn(),
    import: vi.fn()
  };

  const NoteCommands = {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn()
  };

  const SearchCommands = {
    query: vi.fn(),
    rebuild: vi.fn()
  };

  const SettingsCommands = {
    get: vi.fn(),
    set: vi.fn()
  };

  const ReviewCommands = {
    summary: vi.fn()
  };

  return { PaperCommands, NoteCommands, SearchCommands, SettingsCommands, ReviewCommands };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
