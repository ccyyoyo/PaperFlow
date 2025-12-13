# PaperFlow Tauri API (v0.1)

This document specifies the Rust Tauri commands exposed to the React app, the payload/response shapes (JSON, camelCase), and behavioral notes. Targets MVP + near-term search work.

All examples use the Tauri JS API: `import { invoke } from '@tauri-apps/api/tauri'`.

## Conventions
- Transport: Tauri `invoke` commands (local, no HTTP).
- Encoding: JSON, camelCase via `serde(rename_all = "camelCase")`.
- Timestamps: ISO 8601 UTC strings.
- Errors: for now, error strings (`Result<T, String>`). Long‑term: typed codes (see Error Model).

## Data Models

Note
- id: string
- paperId: string
- page: number (1-based)
- anchorYTopNorm: number | null (0..1, top edge of selected text; used for card sidebar alignment)
- quote: string | null (selected text, optional; used for preview/search)
- content: string (required, trimmed, <= 10_000 chars)
- color: string | null (semantic key, e.g. 'idea'|'method'|'result')
- tags: string | null (comma-separated in DB; UI maps to string[])
- createdAt: string | null (ISO)
- updatedAt: string | null (ISO)

Paper
- id: string
- workspaceId: string
- title: string
- path: string (absolute OS path)
- createdAt: string | null
- updatedAt: string | null

Unless specified, nullables may be returned as null by the database layer. The UI should defensively coerce as needed.

## Commands

### upsert_paper_command(title: string, path: string) -> Paper
Ensures a Paper row exists for a file path (creates under default workspace if absent). Returns the Paper (existing or new).

TypeScript
```
const paper = await invoke<Paper>('upsert_paper_command', { title, path })
```

### list_notes_command(paperId: string) -> Note[]
Lists notes for a paper, ordered by (page, createdAt).

TypeScript
```
const notes = await invoke<Note[]>('list_notes_command', { paperId })
```

### create_note_command(input: NewNoteInput) -> Note
Creates a note.

NewNoteInput
- paperId: string
- page: number
- anchorYTopNorm: number | null
- quote?: string | null
- content: string
- color?: string | null
- tags?: string | null (comma-separated)

TypeScript
```
const note = await invoke<Note>('create_note_command', {
  input: {
    paperId,
    page,
    anchorYTopNorm,
    quote: null,
    content,
    color,                 // e.g., 'idea'
    tags: tags.join(','),  // UI string[] -> comma-separated
  }
})
```

### update_note_command(payload: UpdateNoteInput) -> Note
Updates content/color/tags of a single note (also bumps updatedAt).

UpdateNoteInput
- id: string
- content: string
- color?: string | null
- tags?: string | null (comma-separated)

TypeScript
```
const note = await invoke<Note>('update_note_command', {
  payload: { id, content, color, tags: tags.join(',') }
})
```

### delete_note_command(noteId: string) -> void
Deletes a note by id.

TypeScript
```
await invoke('delete_note_command', { noteId })
```

## Planned: Search (FTS5)

SQLite FTS5 index is provisioned (see sql/0001_init.sql) but API is not wired yet. Target shape:

search_notes_command(query: SearchQuery) -> SearchHit[]

SearchQuery
- q: string (FTS5 query; support quotes, prefix `abc*`, `NEAR/k`)
- paperId?: string (limit to a paper)
- limit?: number (default 20)
- offset?: number (default 0)

SearchHit
- refType: 'note' | 'paper'
- refId: string (noteId when refType='note')
- paperId: string
- page?: number
- rank: number (bm25)
- snippet: string (HTML-safe, with <mark> tags)

Example
```
const hits = await invoke<SearchHit[]>('search_notes_command', {
  query: { q: 'matrix NEAR/5 rank', paperId, limit: 20 }
})
```

Implementation Notes (server‑side)
- Prefer FTS5 external content with triggers (already scaffolded) to avoid duplication.
- Ranking via `bm25(fts)`; snippet via `snippet(fts, 0, '<mark>','</mark>','…', 10)`.
- For CJK, consider `prefix='2,3'` and/or ICU/N‑gram tokenizer.

## Validation & Limits
- content: must be non-empty after trim; suggested max 10k chars.
- page: >= 1 and <= paper.totalPages (UI enforces; DB trusts input).
- tags: UI maintains string[]; backend expects comma-separated (no spaces recommended).
- color: free-form key; UI maps to taxonomy (idea/method/result or user-defined).
- Anchor (`anchorYTopNorm`): normalized 0..1; optional.

## Error Model (current)
- All commands return `Result<T, String>`. The string is a human-readable message from DB or app layer.
- Recommended UI pattern
  - optimistic UI with toast feedback
  - on error: show toast + keep local state (drafts) so user can retry

Future (typed errors)
- { code: 'DB_BUSY' | 'VALIDATION' | 'NOT_FOUND' | 'CONFLICT' | 'UNKNOWN', message: string }

## Storage Locations
- Database file: per‑platform app data dir, filename `paperflow.sqlite`.
  - Windows: `%APPDATA%/com.paperflow.app/paperflow.sqlite`
  - macOS: `~/Library/Application Support/com.paperflow.app/paperflow.sqlite`
  - Linux: `~/.local/share/com.paperflow.app/paperflow.sqlite`

## Security & Permissions
- Tauri allowlist enabled for dialog/open, fs/path, and asset protocol (see `src-tauri/tauri.conf.json`).
- CSP disabled for now (`security.csp = null`) during development; restrict for production.

## Versioning & Compatibility
- This document tracks app version ≥ 0.1. Minor changes to payloads should be appended compatibly.
- Breaking changes will bump this file’s header version.

## Quick Reference (TS)
```
import { invoke } from '@tauri-apps/api/tauri'

// Ensure paper exists
const paper = await invoke('upsert_paper_command', { title: 'sample.pdf', path: 'C:\\sample.pdf' })

// List notes
const notes = await invoke('list_notes_command', { paperId: paper.id })

  // Create note
  await invoke('create_note_command', {
  input: { paperId: paper.id, page: 3, anchorYTopNorm: 0.32, quote: null, content: 'Idea', color: 'idea', tags: 'tag1,tag2' }
  })

// Update note
await invoke('update_note_command', { payload: { id: notes[0].id, content: 'Updated', color: 'result', tags: 'tag1' } })

// Delete note
await invoke('delete_note_command', { noteId: notes[0].id })
```
