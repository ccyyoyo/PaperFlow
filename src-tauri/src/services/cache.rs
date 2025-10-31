use std::collections::VecDeque;

#[derive(Debug, Default)]
pub struct PageCacheConfig {
    pub max_entries: usize,
}

#[derive(Debug)]
pub struct PageCache {
    entries: VecDeque<String>,
    config: PageCacheConfig,
}

impl PageCache {
    pub fn new(config: PageCacheConfig) -> Self {
        Self {
            entries: VecDeque::new(),
            config,
        }
    }

    pub fn record(&mut self, key: String) {
        if self.entries.len() >= self.config.max_entries {
            self.entries.pop_front();
        }
        self.entries.push_back(key);
    }

    pub fn clear(&mut self) {
        self.entries.clear();
    }
}
