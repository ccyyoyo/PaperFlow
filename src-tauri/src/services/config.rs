use std::{fs, path::PathBuf};

use crate::domain::AppSettings;

const APP_DATA_DIR: &str = "PaperFlow";

pub fn ensure_directories() -> anyhow::Result<()> {
    let appdata = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let local_appdata = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));

    let db_path = appdata.join(APP_DATA_DIR).join("db.sqlite");
    let cache_dir = local_appdata.join(APP_DATA_DIR).join("cache");
    let logs_dir = local_appdata.join(APP_DATA_DIR).join("logs");
    let config_path = appdata.join(APP_DATA_DIR);

    if let Some(parent) = db_path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::create_dir_all(&cache_dir)?;
    fs::create_dir_all(&logs_dir)?;
    fs::create_dir_all(&config_path)?;

    Ok(())
}

pub fn db_path() -> PathBuf {
    let appdata = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    appdata.join(APP_DATA_DIR).join("db.sqlite")
}

pub fn settings_path() -> PathBuf {
    let appdata = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    appdata.join(APP_DATA_DIR).join("config.json")
}

pub fn load_settings() -> anyhow::Result<AppSettings> {
    let path = settings_path();
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let data = fs::read_to_string(path)?;
    let settings = serde_json::from_str(&data)?;
    Ok(settings)
}

pub fn save_settings(settings: &AppSettings) -> anyhow::Result<()> {
    let path = settings_path();
    let json = serde_json::to_string_pretty(settings)?;
    fs::write(path, json)?;
    Ok(())
}
