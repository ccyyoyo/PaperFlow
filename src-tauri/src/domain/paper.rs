use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Paper {
    pub id: String,
    pub workspace_id: String,
    pub title: String,
    pub doi: Option<String>,
    pub path: String,
    pub last_seen_path: Option<String>,
    pub file_hash: String,
    pub filesize: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PaperImportRequest {
    pub paths: Vec<String>,
    pub workspace_id: String,
}
