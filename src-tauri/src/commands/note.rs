use tauri::State;

use crate::domain::{NewNote, Note, UpdateNote};
use crate::services::{repo, state::AppState};
use crate::telemetry::IpcResult;

#[tauri::command]
pub async fn note_list(state: State<'_, AppState>, paper_id: String) -> IpcResult<Vec<Note>> {
    repo::list_notes(&state.db, &paper_id)
}

#[tauri::command]
pub async fn note_get(state: State<'_, AppState>, note_id: String) -> IpcResult<Note> {
    repo::get_note(&state.db, &note_id)
}

#[tauri::command]
pub async fn note_create(state: State<'_, AppState>, input: NewNote) -> IpcResult<Note> {
    repo::create_note(&state.db, &input)
}

#[tauri::command]
pub async fn note_update(state: State<'_, AppState>, input: UpdateNote) -> IpcResult<Note> {
    repo::update_note(&state.db, &input)
}

#[tauri::command]
pub async fn note_delete(state: State<'_, AppState>, note_id: String) -> IpcResult<()> {
    repo::delete_note(&state.db, &note_id)
}
