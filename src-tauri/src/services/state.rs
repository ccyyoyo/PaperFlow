use std::sync::Arc;

use parking_lot::Mutex;

use super::{
    cache::{PageCache, PageCacheConfig},
    db::Db,
};

#[derive(Clone)]
pub struct AppState {
    pub db: Db,
    pub page_cache: Arc<Mutex<PageCache>>,
}

impl Default for AppState {
    fn default() -> Self {
        let cache = PageCache::new(PageCacheConfig { max_entries: 128 });
        Self {
            db: Db::default(),
            page_cache: Arc::new(Mutex::new(cache)),
        }
    }
}
