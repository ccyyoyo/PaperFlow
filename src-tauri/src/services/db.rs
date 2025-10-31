use parking_lot::{Mutex, MutexGuard};
use rusqlite::Connection;
use std::sync::Arc;

#[derive(Clone)]
pub struct Db {
    inner: Arc<Mutex<Connection>>,
}

impl Db {
    pub fn connect() -> anyhow::Result<Self> {
        let path = super::config::db_path();
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")?;
        Ok(Self {
            inner: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn in_memory() -> anyhow::Result<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch("PRAGMA foreign_keys = ON;")?;
        Ok(Self {
            inner: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn connection(&self) -> MutexGuard<'_, Connection> {
        self.inner.lock()
    }
}

impl Default for Db {
    fn default() -> Self {
        Self::connect().unwrap_or_else(|_| Self::in_memory().expect("in-memory db fail"))
    }
}
