use crate::domain::AppSettings;
use crate::services::config;
use crate::telemetry::{IpcError, IpcResult, IpcStatus};

#[tauri::command]
pub async fn settings_get() -> IpcResult<AppSettings> {
    config::load_settings().map_err(|err| IpcError::new(IpcStatus::Internal, err.to_string()))
}

#[tauri::command]
pub async fn settings_set(settings: AppSettings) -> IpcResult<()> {
    config::save_settings(&settings)
        .map_err(|err| IpcError::new(IpcStatus::Internal, err.to_string()))
}
