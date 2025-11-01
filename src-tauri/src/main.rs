#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod note;

use note::{NewNoteInput, Note, UpdateNoteInput};
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};

#[derive(Clone)]
struct AppState {
  conn: Arc<Mutex<Connection>>,
}

#[tauri::command]
fn create_note_command(state: State<AppState>, input: NewNoteInput) -> Result<Note, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "資料庫連線忙碌中，稍後再試".to_string())?;
  note::create_note(&conn, input).map_err(|err| err.to_string())
}

#[tauri::command]
fn list_notes_command(state: State<AppState>, paper_id: String) -> Result<Vec<Note>, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "資料庫連線忙碌中，稍後再試".to_string())?;
  note::list_notes_by_paper(&conn, &paper_id).map_err(|err| err.to_string())
}

#[tauri::command]
fn update_note_command(state: State<AppState>, payload: UpdateNoteInput) -> Result<Note, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "資料庫連線忙碌中，稍後再試".to_string())?;
  note::update_note(&conn, payload).map_err(|err| err.to_string())
}

#[tauri::command]
fn delete_note_command(state: State<AppState>, note_id: String) -> Result<(), String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "資料庫連線忙碌中，稍後再試".to_string())?;
  note::delete_note(&conn, &note_id)
    .map_err(|err| err.to_string())
    .map(|_| ())
}

fn database_path(app: &tauri::AppHandle) -> std::io::Result<PathBuf> {
  let resolver = app.path_resolver();
  let mut path = resolver
    .app_data_dir()
    .ok_or_else(|| {
      std::io::Error::new(
        std::io::ErrorKind::NotFound,
        "無法取得應用程式資料夾",
      )
    })?;
  path.push("paperflow.sqlite");
  Ok(path)
}

fn main() {
  tauri::Builder::default()
    .setup(|app| {
      let app_handle = app.handle();
      let path = database_path(&app_handle)?;
      let conn = db::init_database(&path)?;
      app.manage(AppState {
        conn: Arc::new(Mutex::new(conn)),
      });
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      create_note_command,
      list_notes_command,
      update_note_command,
      delete_note_command
    ])
    .run(tauri::generate_context!())
    .expect("error while running PaperFlow");
}
