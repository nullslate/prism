use log::{debug, error, info, warn};

#[tauri::command]
pub fn log_message(level: String, message: String) -> Result<(), String> {
    match level.to_lowercase().as_str() {
        "debug" => debug!("{}", message),
        "info" => info!("{}", message),
        "warn" => warn!("{}", message),
        "error" => error!("{}", message),
        _ => info!("{}", message), // Default to info for unknown levels
    }
    Ok(())
}