use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SearchHit {
    pub ref_type: String,
    pub ref_id: String,
    pub snippet: Option<String>,
    pub score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SearchRebuildProgress {
    pub done: usize,
    pub total: usize,
    pub stage: String,
}
