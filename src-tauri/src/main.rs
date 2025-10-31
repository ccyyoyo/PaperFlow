#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod domain;
mod services;
mod telemetry;
mod utils;

use tauri::Manager;

fn main() {
    telemetry::logging::init();

    let builder = tauri::Builder::default()
        .setup(|app| {
            if let Err(err) = services::config::ensure_directories() {
                telemetry::logging::log_startup_error("config::ensure_directories", &err);
            }

            if let Err(err) = services::migration::ensure_initialized() {
                telemetry::logging::log_startup_error("migration::ensure_initialized", &err);
            }

            app.manage(services::state::AppState::default());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::system::ping,
            commands::paper::paper_open,
            commands::paper::paper_import,
            commands::paper::paper_list,
            commands::note::note_create,
            commands::note::note_list,
            commands::note::note_update,
            commands::note::note_delete,
            commands::search::search_query,
            commands::search::search_rebuild,
            commands::preview::preview_get,
            commands::review::review_summary,
            commands::settings::settings_get,
            commands::settings::settings_set,
            commands::shortcuts::shortcut_register,
            commands::shortcuts::shortcut_unregister
        ]);

    builder
        .plugin(tauri_plugin_log::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running PaperFlow application");
}
