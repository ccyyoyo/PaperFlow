use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NoteStats {
    pub note_id: String,
    pub review_count: i64,
    pub last_reviewed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PaperStats {
    pub paper_id: String,
    pub total_read_time: i64,
    pub last_opened_page: Option<i64>,
}
