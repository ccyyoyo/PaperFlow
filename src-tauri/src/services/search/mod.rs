pub mod fts;

use crate::{
    domain::SearchHit,
    telemetry::{IpcError, IpcResult, IpcStatus},
};
use rusqlite::params;

pub const NOTE_REF_TYPE: &str = "note";

pub fn query(db: &super::Db, term: &str, limit: u32) -> IpcResult<Vec<SearchHit>> {
    let Some(match_expr) = build_match_expression(term) else {
        return Ok(vec![]);
    };

    let capped_limit = limit.clamp(1, 100) as i64;
    let mut conn = db.connection();
    let mut stmt = conn
        .prepare(
            "SELECT refType, refId, snippet(search_index, 0, '<b>', '</b>', ' ... ', 10) AS snippet, \
             bm25(search_index) AS rank \
             FROM search_index \
             WHERE search_index MATCH ?1 \
             ORDER BY rank ASC \
             LIMIT ?2",
        )
        .map_err(db_error)?;

    let hits = stmt
        .query_map(params![match_expr, capped_limit], |row| {
            let rank: f64 = row.get("rank")?;
            let score = if rank.is_finite() {
                (1.0 / (1.0 + rank)) as f32
            } else {
                0.0
            };

            Ok(SearchHit {
                ref_type: row.get("refType")?,
                ref_id: row.get("refId")?,
                snippet: row.get::<_, Option<String>>("snippet")?,
                score,
            })
        })
        .map_err(db_error)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_error)?;

    Ok(hits)
}

pub fn rebuild(db: &super::Db) -> IpcResult<()> {
    let mut conn = db.connection();
    let tx = conn.transaction().map_err(db_error)?;

    tx.execute("DELETE FROM search_index", [])
        .map_err(db_error)?;

    let mut stmt = tx
        .prepare("SELECT id, content FROM note")
        .map_err(db_error)?;
    let mut rows = stmt.query([]).map_err(db_error)?;
    while let Some(row) = rows.next().map_err(db_error)? {
        let note_id: String = row.get("id")?;
        let content: String = row.get("content")?;
        upsert_entry(&tx, NOTE_REF_TYPE, &note_id, &content)?;
    }

    tx.commit().map_err(db_error)?;
    Ok(())
}

pub fn upsert_entry(
    conn: &rusqlite::Connection,
    ref_type: &str,
    ref_id: &str,
    raw_content: &str,
) -> rusqlite::Result<()> {
    remove_entry(conn, ref_type, ref_id)?;

    if let Some(normalized) = normalize_content(raw_content) {
        conn.execute(
            "INSERT INTO search_index (content, refType, refId) VALUES (?1, ?2, ?3)",
            params![normalized, ref_type, ref_id],
        )?;
    }
    Ok(())
}

pub fn remove_entry(
    conn: &rusqlite::Connection,
    ref_type: &str,
    ref_id: &str,
) -> rusqlite::Result<()> {
    conn.execute(
        "DELETE FROM search_index WHERE refType = ?1 AND refId = ?2",
        params![ref_type, ref_id],
    )?;
    Ok(())
}

fn build_match_expression(term: &str) -> Option<String> {
    let trimmed = term.trim();
    if trimmed.is_empty() {
        return None;
    }

    let mut tokens = fts::tokenize(trimmed);
    if tokens.is_empty() {
        tokens = trimmed
            .split_whitespace()
            .map(|t| t.to_string())
            .collect::<Vec<_>>();
    }

    if tokens.is_empty() {
        return None;
    }

    Some(
        tokens
            .into_iter()
            .map(|token| format!("{token}*"))
            .collect::<Vec<_>>()
            .join(" "),
    )
}

fn normalize_content(raw: &str) -> Option<String> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return None;
    }

    let tokens = fts::tokenize(trimmed);
    if tokens.is_empty() {
        Some(trimmed.replace('\n', " "))
    } else {
        Some(tokens.join(" "))
    }
}

fn db_error(err: rusqlite::Error) -> IpcError {
    IpcError::new(IpcStatus::DbError, err.to_string())
}
