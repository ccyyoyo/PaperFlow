//! 檔案說明：Tauri 應用進入點，註冊命令並初始化資料庫連線。
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod db;
mod note;
mod paper;

use note::{NewNoteInput, Note, UpdateNoteInput};
use paper::Paper;
use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{Manager, State};

/// 應用全域狀態（封裝資料庫連線）。
#[derive(Clone)]
struct AppState {
  /// 受 Mutex 保護的資料庫連線（跨執行緒共用）。
  conn: Arc<Mutex<Connection>>,
}

/// 建立一筆筆記。
#[tauri::command]
fn create_note_command(state: State<AppState>, input: NewNoteInput) -> Result<Note, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "資料庫連線忙碌中，稍後再試".to_string())?;
  note::create_note(&conn, input).map_err(|err| err.to_string())
}

/// 依論文（PDF）識別取得其所有筆記。
#[tauri::command]
fn list_notes_command(state: State<AppState>, paper_id: String) -> Result<Vec<Note>, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "資料庫連線忙碌中，稍後再試".to_string())?;
  note::list_notes_by_paper(&conn, &paper_id).map_err(|err| err.to_string())
}

/// 更新指定筆記內容/顏色/標籤。
#[tauri::command]
fn update_note_command(state: State<AppState>, payload: UpdateNoteInput) -> Result<Note, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "資料庫連線忙碌中，稍後再試".to_string())?;
  note::update_note(&conn, payload).map_err(|err| err.to_string())
}

/// 刪除指定筆記。
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

/// 依檔案路徑新增或更新 Paper 記錄。
#[tauri::command]
fn upsert_paper_command(
  state: State<AppState>,
  title: String,
  path: String,
) -> Result<Paper, String> {
  let conn = state
    .conn
    .lock()
    .map_err(|_| "資料庫連線忙碌中，稍後再試".to_string())?;
  paper::upsert_paper_by_path(&conn, &path, &title).map_err(|err| err.to_string())
}

/// 取得資料庫檔案路徑（位於應用資料目錄下）。
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

/// 應用程式進入點：初始化資料庫、註冊命令並啟動事件迴圈。
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
      delete_note_command,
      upsert_paper_command
    ])
    .run(tauri::generate_context!())
    .expect("error while running PaperFlow");
}
