-- PaperFlow SQLite schema draft
-- Contains tables for workspaces, papers, notes, and statistics.

CREATE TABLE IF NOT EXISTS workspace (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS paper (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  doi TEXT,
  path TEXT NOT NULL,
  metadata JSON,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS note (
  id TEXT PRIMARY KEY,
  paper_id TEXT NOT NULL REFERENCES paper(id) ON DELETE CASCADE,
  page INTEGER NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  text_hash TEXT,
  content TEXT NOT NULL,
  color TEXT,
  tags TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_note_paper_page
  ON note(paper_id, page);

CREATE TABLE IF NOT EXISTS note_link (
  from_note_id TEXT NOT NULL REFERENCES note(id) ON DELETE CASCADE,
  to_note_id TEXT NOT NULL REFERENCES note(id) ON DELETE CASCADE,
  link_type TEXT DEFAULT 'reference',
  PRIMARY KEY (from_note_id, to_note_id)
);

CREATE TABLE IF NOT EXISTS note_stats (
  note_id TEXT PRIMARY KEY REFERENCES note(id) ON DELETE CASCADE,
  review_count INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TEXT,
  pinned INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS paper_stats (
  paper_id TEXT PRIMARY KEY REFERENCES paper(id) ON DELETE CASCADE,
  total_read_time_seconds INTEGER NOT NULL DEFAULT 0,
  last_opened_page INTEGER,
  last_opened_at TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5(
  content,
  ref_type,
  ref_id,
  tokenize = "porter"
);

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
