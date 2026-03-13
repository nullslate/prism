use log::{debug, error, info, warn};

#[tauri::command]
pub fn log_message(level: String, message: String) -> Result<(), String> {
    match level.to_lowercase().as_str() {
        "debug" => debug!(target: "prism::webview", "{}", message),
        "info" => info!(target: "prism::webview", "{}", message),
        "warn" => warn!(target: "prism::webview", "{}", message),
        "error" => error!(target: "prism::webview", "{}", message),
        _ => info!(target: "prism::webview", "{}", message),
    }
    Ok(())
}
