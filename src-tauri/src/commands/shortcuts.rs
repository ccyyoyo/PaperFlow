use crate::telemetry::IpcResult;

#[tauri::command]
pub async fn shortcut_register(key: String, action: String) -> IpcResult<()> {
    tracing::info!(target = "shortcut", %key, %action, "register shortcut (placeholder)");
    Ok(())
}

#[tauri::command]
pub async fn shortcut_unregister(key: String) -> IpcResult<()> {
    tracing::info!(target = "shortcut", %key, "unregister shortcut (placeholder)");
    Ok(())
}
