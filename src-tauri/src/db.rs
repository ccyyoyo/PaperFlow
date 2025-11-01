use rusqlite::{params, Connection};
use std::{error::Error, fs, path::Path};

struct Migration {
  version: i32,
  _name: &'static str,
  sql: &'static str,
}

const MIGRATIONS: &[Migration] = &[Migration {
  version: 1,
  _name: "init_schema",
  sql: include_str!("../sql/0001_init.sql"),
}];

pub fn init_database(path: &Path) -> Result<Connection, Box<dyn Error>> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)?;
  }

  let mut conn = Connection::open(path)?;
  conn.execute_batch("PRAGMA foreign_keys = ON;")?;
  apply_migrations(&mut conn)?;
  Ok(conn)
}

fn apply_migrations(conn: &mut Connection) -> Result<(), Box<dyn Error>> {
  conn.execute(
    "CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )",
    [],
  )?;

  let mut applied_version: i32 = conn
    .query_row(
      "SELECT COALESCE(MAX(version), 0) FROM schema_version",
      [],
      |row| row.get(0),
    )
    .unwrap_or(0);

  for migration in MIGRATIONS {
    if migration.version > applied_version {
      let tx = conn.transaction()?;
      tx.execute_batch(migration.sql)?;
      tx.execute(
        "INSERT INTO schema_version (version) VALUES (?1)",
        params![migration.version],
      )?;
      tx.commit()?;
      applied_version = migration.version;
    }
  }

  Ok(())
}
