use crate::telemetry::IpcResult;

#[tauri::command]
pub async fn ping() -> IpcResult<String> {
    Ok("pong".into())
}
