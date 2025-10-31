use anyhow::Result;

#[allow(dead_code)]
pub struct FileWatcher;

impl FileWatcher {
    pub fn start() -> Result<Self> {
        // TODO: wire up notify crate to watch PDF path changes.
        Ok(Self)
    }
}
