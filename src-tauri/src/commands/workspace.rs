use tauri::State;

use crate::domain::Workspace;
use crate::services::{repo, state::AppState};
use crate::telemetry::IpcResult;

#[tauri::command]
pub async fn workspace_list(state: State<'_, AppState>) -> IpcResult<Vec<Workspace>> {
    repo::list_workspaces(&state.db)
}

#[tauri::command]
pub async fn workspace_create(state: State<'_, AppState>, name: String) -> IpcResult<Workspace> {
    repo::create_workspace(&state.db, &name)
}

#[tauri::command]
pub async fn workspace_rename(
    state: State<'_, AppState>,
    id: String,
    name: String,
) -> IpcResult<Workspace> {
    repo::rename_workspace(&state.db, &id, &name)
}

#[tauri::command]
pub async fn workspace_delete(state: State<'_, AppState>, id: String) -> IpcResult<()> {
    repo::delete_workspace(&state.db, &id)
}
