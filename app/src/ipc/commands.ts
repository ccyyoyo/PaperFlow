import { invokeCommand } from './index';

import { NewNote, Note, UpdateNote } from '../types/note';
import { Paper, PaperImportRequest } from '../types/paper';
import { SearchHit } from '../types/search';
import { AppSettings } from '../types/settings';

export const PaperCommands = {
  open: (paperId: string) => invokeCommand<Paper>('paper_open', { paper_id: paperId }),
  import: (request: PaperImportRequest) => invokeCommand<Paper[]>('paper_import', { request }),
  list: (workspaceId: string) => invokeCommand<Paper[]>('paper_list', { workspace_id: workspaceId })
};

export const NoteCommands = {
  list: (paperId: string) => invokeCommand<Note[]>('note_list', { paper_id: paperId }),
  create: (input: NewNote) => invokeCommand<Note>('note_create', { input }),
  update: (input: UpdateNote) => invokeCommand<Note>('note_update', { input }),
  remove: (noteId: string) => invokeCommand<void>('note_delete', { note_id: noteId })
};

export const SearchCommands = {
  query: (term: string, limit = 20) => invokeCommand<SearchHit[]>('search_query', { term, limit }),
  rebuild: () => invokeCommand<void>('search_rebuild')
};

export const SettingsCommands = {
  get: () => invokeCommand<AppSettings>('settings_get'),
  set: (settings: AppSettings) => invokeCommand<void>('settings_set', { settings })
};

export const ReviewCommands = {
  summary: () => invokeCommand<{ notes_to_review: number; total_read_time: number }>('review_summary')
};
