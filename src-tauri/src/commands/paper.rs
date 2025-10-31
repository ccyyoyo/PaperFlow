use tauri::State;

use crate::domain::{Paper, PaperImportRequest};
use crate::services::{repo, state::AppState};
use crate::telemetry::IpcResult;

#[tauri::command]
pub async fn paper_open(state: State<'_, AppState>, paper_id: String) -> IpcResult<Paper> {
    repo::get_paper(&state.db, &paper_id)
}

#[tauri::command]
pub async fn paper_import(
    state: State<'_, AppState>,
    request: PaperImportRequest,
) -> IpcResult<Vec<Paper>> {
    repo::import_papers(&state.db, &request)
}

#[tauri::command]
pub async fn paper_list(
    state: State<'_, AppState>,
    workspace_id: Option<String>,
) -> IpcResult<Vec<Paper>> {
    let workspace_id = workspace_id
        .as_deref()
        .map(str::trim)
        .filter(|id| !id.is_empty())
        .unwrap_or("default_workspace");
    repo::list_papers(&state.db, workspace_id)
}
