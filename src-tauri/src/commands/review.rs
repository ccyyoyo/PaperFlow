use serde::Serialize;

use crate::telemetry::IpcResult;

#[derive(Debug, Serialize)]
pub struct ReviewSummary {
    pub notes_to_review: usize,
    pub total_read_time: u32,
}

#[tauri::command]
pub async fn review_summary() -> IpcResult<ReviewSummary> {
    Ok(ReviewSummary {
        notes_to_review: 0,
        total_read_time: 0,
    })
}
