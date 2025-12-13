-- Migration 0002: Switch note anchor model from (x, y, text_hash) to (anchor_y_top_norm, quote).
-- This supports a card sidebar that aligns cards vertically next to selected text.
-- IMPORTANT: This script is executed inside an outer transaction by the migration runner.

-- Drop triggers that reference the old note table.
DROP TRIGGER IF EXISTS trg_note_insert_search;
DROP TRIGGER IF EXISTS trg_note_update_search;
DROP TRIGGER IF EXISTS trg_note_delete_search;

-- Create the new note table.
CREATE TABLE IF NOT EXISTS note_new (
  id TEXT PRIMARY KEY,
  paper_id TEXT NOT NULL REFERENCES paper(id) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  anchor_y_top_norm REAL,
  quote TEXT,
  content TEXT NOT NULL,
  color TEXT,
  tags TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

-- Migrate existing data (use previous y as anchor_y_top_norm).
INSERT INTO note_new (id, paper_id, page, anchor_y_top_norm, quote, content, color, tags, created_at, updated_at)
SELECT id, paper_id, page, y, NULL, content, color, tags, created_at, updated_at
FROM note;

DROP TABLE note;
ALTER TABLE note_new RENAME TO note;

CREATE INDEX IF NOT EXISTS idx_note_paper_page
  ON note(paper_id, page);

-- Recreate FTS triggers.
CREATE TRIGGER IF NOT EXISTS trg_note_insert_search AFTER INSERT ON note
BEGIN
  INSERT INTO search_index (content, ref_type, ref_id)
  VALUES (new.content, 'note', new.id);
END;

CREATE TRIGGER IF NOT EXISTS trg_note_update_search AFTER UPDATE ON note
BEGIN
  UPDATE search_index
  SET content = new.content
  WHERE ref_type = 'note' AND ref_id = new.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_note_delete_search AFTER DELETE ON note
BEGIN
  DELETE FROM search_index
  WHERE ref_type = 'note' AND ref_id = old.id;
END;
