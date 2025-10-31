use serde::Serialize;

use crate::telemetry::IpcResult;

#[derive(Debug, Clone, Serialize)]
pub struct PreviewCard {
    pub ref_id: String,
    pub ref_type: String,
    pub snippet: String,
}

#[tauri::command]
pub async fn preview_get(ref_type: String, ref_id: String) -> IpcResult<PreviewCard> {
    Ok(PreviewCard {
        ref_id,
        ref_type,
        snippet: "尚未實作的預覽內容".into(),
    })
}
