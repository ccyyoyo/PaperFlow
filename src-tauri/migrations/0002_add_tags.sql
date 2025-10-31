-- Normalize tags into dedicated tables
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS tag (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    color TEXT,
    createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS note_tag (
    noteId TEXT NOT NULL,
    tagId TEXT NOT NULL,
    PRIMARY KEY (noteId, tagId),
    FOREIGN KEY (noteId) REFERENCES note(id) ON DELETE CASCADE,
    FOREIGN KEY (tagId) REFERENCES tag(id) ON DELETE CASCADE
);
