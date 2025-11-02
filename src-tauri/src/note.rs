//! 模組說明：筆記（Note）資料結構與 CRUD 操作。
use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// 筆記實體。
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
  pub id: String,
  pub paper_id: String,
  pub page: i32,
  pub x: f32,
  pub y: f32,
  pub text_hash: Option<String>,
  pub content: String,
  pub color: Option<String>,
  pub tags: Option<String>,
  pub created_at: Option<String>,
  pub updated_at: Option<String>,
}

/// 新增筆記的輸入資料。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewNoteInput {
  pub paper_id: String,
  pub page: i32,
  pub x: f32,
  pub y: f32,
  pub text_hash: Option<String>,
  pub content: String,
  pub color: Option<String>,
  pub tags: Option<String>,
}

/// 更新筆記的輸入資料。
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNoteInput {
  pub id: String,
  pub content: String,
  pub color: Option<String>,
  pub tags: Option<String>,
}

/// 建立一筆筆記並回傳完整筆記資料。
pub fn create_note(conn: &Connection, input: NewNoteInput) -> Result<Note> {
  let id = Uuid::new_v4().to_string();
  conn.execute(
    "INSERT INTO note (id, paper_id, page, x, y, text_hash, content, color, tags)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
    params![
      id,
      input.paper_id,
      input.page,
      input.x,
      input.y,
      input.text_hash,
      input.content,
      input.color,
      input.tags
    ],
  )?;

  fetch_note(conn, &id)
}

/// 依 Paper 識別列出其所有筆記，依頁碼與建立時間排序。
pub fn list_notes_by_paper(conn: &Connection, paper_id: &str) -> Result<Vec<Note>> {
  let mut stmt = conn.prepare(
    "SELECT id, paper_id, page, x, y, text_hash, content, color, tags, created_at, updated_at
     FROM note
     WHERE paper_id = ?
     ORDER BY page, created_at",
  )?;

  let iter = stmt.query_map(params![paper_id], |row| {
    Ok(Note {
      id: row.get(0)?,
      paper_id: row.get(1)?,
      page: row.get(2)?,
      x: row.get(3)?,
      y: row.get(4)?,
      text_hash: row.get(5)?,
      content: row.get(6)?,
      color: row.get(7)?,
      tags: row.get(8)?,
      created_at: row.get(9)?,
      updated_at: row.get(10)?,
    })
  })?;

  iter.collect()
}

/// 更新指定筆記並回傳更新後資料。
pub fn update_note(conn: &Connection, payload: UpdateNoteInput) -> Result<Note> {
  conn.execute(
    "UPDATE note
     SET content = ?2,
         color = ?3,
         tags = ?4,
         updated_at = datetime('now')
     WHERE id = ?1",
    params![payload.id, payload.content, payload.color, payload.tags],
  )?;

  fetch_note(conn, &payload.id)
}

/// 刪除指定筆記。
pub fn delete_note(conn: &Connection, note_id: &str) -> Result<()> {
  conn.execute("DELETE FROM note WHERE id = ?", params![note_id])?;
  Ok(())
}

/// 依 id 取回單筆筆記。
fn fetch_note(conn: &Connection, note_id: &str) -> Result<Note> {
  conn.query_row(
    "SELECT id, paper_id, page, x, y, text_hash, content, color, tags, created_at, updated_at
     FROM note
     WHERE id = ?",
    params![note_id],
    |row| {
      Ok(Note {
        id: row.get(0)?,
        paper_id: row.get(1)?,
        page: row.get(2)?,
        x: row.get(3)?,
        y: row.get(4)?,
        text_hash: row.get(5)?,
        content: row.get(6)?,
        color: row.get(7)?,
        tags: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
      })
    },
  )
}
