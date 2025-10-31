use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    pub id: String,
    pub paper_id: String,
    pub page: i32,
    pub x: f32,
    pub y: f32,
    pub content: String,
    pub color: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct NewNote {
    pub paper_id: String,
    pub page: i32,
    pub x: f32,
    pub y: f32,
    pub content: String,
    pub color: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpdateNote {
    pub id: String,
    pub content: Option<String>,
    pub color: Option<String>,
}
