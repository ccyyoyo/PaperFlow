use tauri::State;

use crate::domain::SearchHit;
use crate::services::{search, state::AppState};
use crate::telemetry::IpcResult;

#[tauri::command]
pub async fn search_query(
    state: State<'_, AppState>,
    term: String,
    limit: Option<u32>,
) -> IpcResult<Vec<SearchHit>> {
    search::query(&state.db, &term, limit.unwrap_or(20))
}

#[tauri::command]
pub async fn search_rebuild(state: State<'_, AppState>) -> IpcResult<()> {
    search::rebuild(&state.db)
}
