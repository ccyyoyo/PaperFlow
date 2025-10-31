use std::{
    convert::TryFrom,
    fs,
    io::{self, Read},
    path::{Path, PathBuf},
};

use crate::{
    domain::{NewNote, Note, Paper, PaperImportRequest, UpdateNote},
    telemetry::{IpcError, IpcResult, IpcStatus},
    utils::time::now_iso,
};
use rusqlite::{params, OptionalExtension};
use sha2::{Digest, Sha256};
use uuid::Uuid;

use super::{search, Db};

pub fn list_papers(db: &Db, workspace_id: &str) -> IpcResult<Vec<Paper>> {
    let mut conn = db.connection();
    let mut stmt = conn
        .prepare(
            "SELECT id, workspaceId, title, doi, path, lastSeenPath, fileHash, filesize, \
             createdAt, updatedAt \
             FROM paper \
             WHERE workspaceId = ?1 \
             ORDER BY datetime(updatedAt) DESC, title ASC",
        )
        .map_err(db_error)?;

    let papers = stmt
        .query_map(params![workspace_id], map_paper)
        .map_err(db_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_error)?;

    Ok(papers)
}

pub fn list_notes(db: &Db, paper_id: &str) -> IpcResult<Vec<Note>> {
    if paper_id.trim().is_empty() {
        return Err(IpcError::new(IpcStatus::BadRequest, "paperId is required"));
    }

    let mut conn = db.connection();
    ensure_paper_exists(&conn, paper_id)?;

    let mut stmt = conn
        .prepare(
            "SELECT id, paperId, page, x, y, content, color, createdAt, updatedAt \
             FROM note WHERE paperId = ?1 \
             ORDER BY datetime(createdAt) ASC",
        )
        .map_err(db_error)?;

    let notes = stmt
        .query_map(params![paper_id], map_note)
        .map_err(db_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_error)?;

    Ok(notes)
}
pub fn import_papers(db: &Db, request: &PaperImportRequest) -> IpcResult<Vec<Paper>> {
    if request.paths.is_empty() {
        return Err(IpcError::new(IpcStatus::BadRequest, "No paths provided"));
    }
    if request.workspace_id.trim().is_empty() {
        return Err(IpcError::new(
            IpcStatus::BadRequest,
            "Workspace id is required",
        ));
    }

    let mut conn = db.connection();
    let tx = conn.transaction().map_err(db_error)?;

    ensure_workspace(&tx, &request.workspace_id)?;

    let mut imported = Vec::with_capacity(request.paths.len());
    for raw_path in &request.paths {
        let resolved = resolve_path(raw_path)?;
        let metadata = fs::metadata(&resolved)
            .map_err(|err| io_error(&resolved, err, "read file metadata for import"))?;
        let file_hash = compute_file_hash(&resolved)?;
        let filesize = i64::try_from(metadata.len()).unwrap_or(i64::MAX);

        let path_str = path_to_string(&resolved)?;
        let title = resolved
            .file_stem()
            .and_then(|s| s.to_str())
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .unwrap_or("Untitled")
            .to_string();
        let now = now_iso();

        let existing = tx
            .prepare(
                "SELECT id, workspaceId, title, doi, path, lastSeenPath, fileHash, filesize, \
                 createdAt, updatedAt \
                 FROM paper \
                 WHERE fileHash = ?1 OR path = ?2 \
                 LIMIT 1",
            )
            .map_err(db_error)?
            .query_row(params![&file_hash, &path_str], map_paper)
            .optional()
            .map_err(db_error)?;

        let paper_id = if let Some(existing) = existing {
            tx.execute(
                "UPDATE paper \
                 SET path = ?2, lastSeenPath = ?3, fileHash = ?4, filesize = ?5, updatedAt = ?6 \
                 WHERE id = ?1",
                params![
                    &existing.id,
                    &path_str,
                    &path_str,
                    &file_hash,
                    &filesize,
                    &now
                ],
            )
            .map_err(db_error)?;
            existing.id
        } else {
            let paper_id = Uuid::new_v4().to_string();
            tx.execute(
                "INSERT INTO paper \
                 (id, workspaceId, title, doi, path, lastSeenPath, fileHash, filesize, createdAt, updatedAt) \
                 VALUES (?1, ?2, ?3, NULL, ?4, ?5, ?6, ?7, ?8, ?8)",
                params![
                    &paper_id,
                    &request.workspace_id,
                    &title,
                    &path_str,
                    &path_str,
                    &file_hash,
                    &filesize,
                    &now
                ],
            )
            .map_err(db_error)?;
            tx.execute(
                "INSERT OR IGNORE INTO paper_stats (paperId) VALUES (?1)",
                params![&paper_id],
            )
            .map_err(db_error)?;
            paper_id
        };

        let paper = tx
            .prepare(
                "SELECT id, workspaceId, title, doi, path, lastSeenPath, fileHash, filesize, \
                 createdAt, updatedAt \
                 FROM paper WHERE id = ?1",
            )
            .map_err(db_error)?
            .query_row(params![&paper_id], map_paper)
            .map_err(db_error)?;

        imported.push(paper);
    }

    tx.commit().map_err(db_error)?;
    Ok(imported)
}

pub fn get_paper(db: &Db, paper_id: &str) -> IpcResult<Paper> {
    let mut conn = db.connection();
    conn.prepare(
        "SELECT id, workspaceId, title, doi, path, lastSeenPath, fileHash, filesize, \
         createdAt, updatedAt \
         FROM paper WHERE id = ?1",
    )
    .map_err(db_error)?
    .query_row(params![paper_id], map_paper)
    .map_err(|err| match err {
        rusqlite::Error::QueryReturnedNoRows => {
            IpcError::new(IpcStatus::NotFound, format!("Paper {paper_id} not found"))
        }
        other => db_error(other),
    })
}

pub fn create_note(db: &Db, note: &NewNote) -> IpcResult<Note> {
    if note.paper_id.trim().is_empty() {
        return Err(IpcError::new(IpcStatus::BadRequest, "paperId is required"));
    }
    if note.content.trim().is_empty() {
        return Err(IpcError::new(
            IpcStatus::BadRequest,
            "Note content cannot be empty",
        ));
    }

    let mut conn = db.connection();
    let tx = conn.transaction().map_err(db_error)?;

    ensure_paper_exists(&tx, &note.paper_id)?;

    let note_id = Uuid::new_v4().to_string();
    let now = now_iso();

    tx.execute(
        "INSERT INTO note \
         (id, paperId, page, x, y, content, color, createdAt, updatedAt) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
        params![
            &note_id,
            &note.paper_id,
            note.page,
            note.x,
            note.y,
            &note.content,
            note.color.as_deref(),
            &now
        ],
    )
    .map_err(db_error)?;

    tx.execute(
        "INSERT OR IGNORE INTO note_stats (noteId) VALUES (?1)",
        params![&note_id],
    )
    .map_err(db_error)?;

    search::upsert_entry(&tx, search::NOTE_REF_TYPE, &note_id, &note.content).map_err(db_error)?;

    let created = tx
        .prepare(
            "SELECT id, paperId, page, x, y, content, color, createdAt, updatedAt \
             FROM note WHERE id = ?1",
        )
        .map_err(db_error)?
        .query_row(params![&note_id], map_note)
        .map_err(db_error)?;

    tx.commit().map_err(db_error)?;
    Ok(created)
}

pub fn update_note(db: &Db, note: &UpdateNote) -> IpcResult<Note> {
    if note.id.trim().is_empty() {
        return Err(IpcError::new(IpcStatus::BadRequest, "id is required"));
    }

    let mut conn = db.connection();
    let tx = conn.transaction().map_err(db_error)?;

    let mut existing = tx
        .prepare(
            "SELECT id, paperId, page, x, y, content, color, createdAt, updatedAt \
             FROM note WHERE id = ?1",
        )
        .map_err(db_error)?
        .query_row(params![&note.id], map_note)
        .map_err(|err| match err {
            rusqlite::Error::QueryReturnedNoRows => {
                IpcError::new(IpcStatus::NotFound, format!("Note {} not found", note.id))
            }
            other => db_error(other),
        })?;

    if let Some(content) = &note.content {
        if content.trim().is_empty() {
            return Err(IpcError::new(
                IpcStatus::BadRequest,
                "Note content cannot be empty",
            ));
        }
        existing.content = content.clone();
    }

    if let Some(color) = &note.color {
        existing.color = Some(color.clone());
    }

    existing.updated_at = now_iso();

    tx.execute(
        "UPDATE note SET content = ?1, color = ?2, updatedAt = ?3 WHERE id = ?4",
        params![
            &existing.content,
            existing.color.as_deref(),
            &existing.updated_at,
            &existing.id
        ],
    )
    .map_err(db_error)?;

    search::upsert_entry(&tx, search::NOTE_REF_TYPE, &existing.id, &existing.content)
        .map_err(db_error)?;

    tx.commit().map_err(db_error)?;
    Ok(existing)
}

pub fn delete_note(db: &Db, note_id: &str) -> IpcResult<()> {
    if note_id.trim().is_empty() {
        return Err(IpcError::new(IpcStatus::BadRequest, "id is required"));
    }

    let mut conn = db.connection();
    let tx = conn.transaction().map_err(db_error)?;

    let deleted = tx
        .execute("DELETE FROM note WHERE id = ?1", params![note_id])
        .map_err(db_error)?;

    if deleted == 0 {
        return Err(IpcError::new(
            IpcStatus::NotFound,
            format!("Note {note_id} not found"),
        ));
    }

    search::remove_entry(&tx, search::NOTE_REF_TYPE, note_id).map_err(db_error)?;

    tx.commit().map_err(db_error)?;
    Ok(())
}

fn map_paper(row: &rusqlite::Row<'_>) -> rusqlite::Result<Paper> {
    Ok(Paper {
        id: row.get("id")?,
        workspace_id: row.get("workspaceId")?,
        title: row.get("title")?,
        doi: row.get("doi")?,
        path: row.get("path")?,
        last_seen_path: row.get("lastSeenPath")?,
        file_hash: row.get("fileHash")?,
        filesize: row.get("filesize")?,
        created_at: row.get("createdAt")?,
        updated_at: row.get("updatedAt")?,
    })
}

fn map_note(row: &rusqlite::Row<'_>) -> rusqlite::Result<Note> {
    Ok(Note {
        id: row.get("id")?,
        paper_id: row.get("paperId")?,
        page: row.get("page")?,
        x: row.get("x")?,
        y: row.get("y")?,
        content: row.get("content")?,
        color: row.get("color")?,
        created_at: row.get("createdAt")?,
        updated_at: row.get("updatedAt")?,
    })
}

fn compute_file_hash(path: &Path) -> Result<String, IpcError> {
    let mut file =
        fs::File::open(path).map_err(|err| io_error(path, err, "open file for hashing"))?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|err| io_error(path, err, "read file for hashing"))?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn resolve_path(path: &str) -> Result<PathBuf, IpcError> {
    let candidate = Path::new(path);
    Ok(fs::canonicalize(candidate).unwrap_or_else(|_| candidate.to_path_buf()))
}

fn path_to_string(path: &Path) -> Result<String, IpcError> {
    if let Some(s) = path.to_str() {
        return Ok(s.to_string());
    }
    Ok(path.to_string_lossy().into_owned())
}

fn db_error(err: rusqlite::Error) -> IpcError {
    IpcError::new(IpcStatus::DbError, err.to_string())
}

fn io_error(path: &Path, err: io::Error, ctx: &str) -> IpcError {
    IpcError::new(
        IpcStatus::IoError,
        format!("Failed to {ctx}: {} ({})", path.display(), err),
    )
}

fn ensure_workspace(conn: &rusqlite::Connection, workspace_id: &str) -> IpcResult<()> {
    let exists = conn
        .prepare("SELECT 1 FROM workspace WHERE id = ?1")
        .map_err(db_error)?
        .query_row(params![workspace_id], |row| row.get::<_, i64>(0))
        .optional()
        .map_err(db_error)?;

    if exists.is_some() {
        return Ok(());
    }

    let now = now_iso();
    conn.execute(
        "INSERT INTO workspace (id, name, createdAt, updatedAt) VALUES (?1, ?2, ?3, ?3)",
        params![workspace_id, workspace_id, &now],
    )
    .map_err(db_error)?;
    Ok(())
}

fn ensure_paper_exists(conn: &rusqlite::Connection, paper_id: &str) -> IpcResult<()> {
    let exists = conn
        .prepare("SELECT 1 FROM paper WHERE id = ?1")
        .map_err(db_error)?
        .query_row(params![paper_id], |row| row.get::<_, i64>(0))
        .optional()
        .map_err(db_error)?;

    if exists.is_some() {
        Ok(())
    } else {
        Err(IpcError::new(
            IpcStatus::NotFound,
            format!("Paper {paper_id} not found"),
        ))
    }
}
