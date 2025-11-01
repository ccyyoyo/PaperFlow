use rusqlite::{params, Connection, Result};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Paper {
  pub id: String,
  pub workspace_id: String,
  pub title: String,
  pub path: String,
  pub created_at: Option<String>,
  pub updated_at: Option<String>,
}

pub fn ensure_default_workspace(conn: &Connection) -> Result<String> {
  let id: Option<String> = conn
    .query_row(
      "SELECT id FROM workspace ORDER BY created_at LIMIT 1",
      [],
      |row| row.get(0),
    )
    .optional()?;

  if let Some(existing) = id {
    return Ok(existing);
  }

  let id = "default".to_string();
  conn.execute(
    "INSERT OR IGNORE INTO workspace (id, name, description) VALUES (?1, ?2, ?3)",
    params![id, "Default Workspace", "Auto-created workspace"],
  )?;
  Ok("default".to_string())
}

pub fn upsert_paper_by_path(conn: &Connection, path: &str, title: &str) -> Result<Paper> {
  // Try fetch by path
  let existing: Option<Paper> = conn
    .query_row(
      "SELECT id, workspace_id, title, path, created_at, updated_at FROM paper WHERE path = ?1",
      params![path],
      |row| {
        Ok(Paper {
          id: row.get(0)?,
          workspace_id: row.get(1)?,
          title: row.get(2)?,
          path: row.get(3)?,
          created_at: row.get(4)?,
          updated_at: row.get(5)?,
        })
      },
    )
    .optional()?;

  if let Some(p) = existing {
    return Ok(p);
  }

  // Insert new under default workspace
  let workspace_id = ensure_default_workspace(conn)?;
  let id = Uuid::new_v4().to_string();
  conn.execute(
    "INSERT INTO paper (id, workspace_id, title, path) VALUES (?1, ?2, ?3, ?4)",
    params![id, workspace_id, title, path],
  )?;

  conn.query_row(
    "SELECT id, workspace_id, title, path, created_at, updated_at FROM paper WHERE id = ?1",
    params![id],
    |row| {
      Ok(Paper {
        id: row.get(0)?,
        workspace_id: row.get(1)?,
        title: row.get(2)?,
        path: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
      })
    },
  )
}

// Helper to add Result::optional for rusqlite without the feature flag
trait OptionalRow<T> {
  fn optional(self) -> rusqlite::Result<Option<T>>;
}

impl<T> OptionalRow<T> for rusqlite::Result<T> {
  fn optional(self) -> rusqlite::Result<Option<T>> {
    match self {
      Ok(v) => Ok(Some(v)),
      Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
      Err(e) => Err(e),
    }
  }
}

