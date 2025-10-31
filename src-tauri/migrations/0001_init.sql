-- Initial schema for PaperFlow
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspace (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS paper (
    id TEXT PRIMARY KEY,
    workspaceId TEXT NOT NULL,
    title TEXT NOT NULL,
    doi TEXT,
    path TEXT NOT NULL,
    lastSeenPath TEXT,
    fileHash TEXT NOT NULL,
    filesize INTEGER,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (workspaceId) REFERENCES workspace(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS note (
    id TEXT PRIMARY KEY,
    paperId TEXT NOT NULL,
    page INTEGER NOT NULL,
    x REAL,
    y REAL,
    content TEXT NOT NULL,
    color TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (paperId) REFERENCES paper(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS note_stats (
    noteId TEXT PRIMARY KEY,
    reviewCount INTEGER DEFAULT 0,
    lastReviewedAt TEXT,
    FOREIGN KEY (noteId) REFERENCES note(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS paper_stats (
    paperId TEXT PRIMARY KEY,
    totalReadTime INTEGER DEFAULT 0,
    lastOpenedPage INTEGER,
    FOREIGN KEY (paperId) REFERENCES paper(id) ON DELETE CASCADE
);

CREATE VIRTUAL TABLE IF NOT EXISTS search_index USING fts5 (
    content,
    refType UNINDEXED,
    refId UNINDEXED
);

CREATE INDEX IF NOT EXISTS idx_paper_workspace ON paper(workspaceId);
CREATE INDEX IF NOT EXISTS idx_note_paper_page ON note(paperId, page);
CREATE INDEX IF NOT EXISTS idx_note_created ON note(createdAt);
