use crate::config::PrismConfig;
use std::process::Command;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn open_in_editor(app: AppHandle, path: String, line: u32) -> Result<String, String> {
    let (editor, terminal, full_path) = {
        let config = app.state::<Mutex<PrismConfig>>();
        let config = config.lock().map_err(|e| e.to_string())?;
        let full_path = config.vault_path().join(&path);
        (config.editor.clone(), config.terminal.clone(), full_path)
    };

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }

    let line_arg = format!("+{}", line);
    let file_arg = full_path.to_string_lossy().to_string();

    let terminal_clone = terminal.clone();
    let editor_clone = editor.clone();
    let _result = tokio::task::spawn_blocking(move || {
        Command::new(&terminal_clone)
            .arg("-e")
            .arg(&editor_clone)
            .arg(&line_arg)
            .arg(&file_arg)
            .status()
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| format!("Failed to spawn {} -e {}: {}", terminal, editor, e))?;

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }

    let content = std::fs::read_to_string(&full_path)
        .map_err(|e| format!("Failed to re-read file: {}", e))?;

    Ok(content)
}

#[tauri::command]
pub async fn open_config_in_editor(app: AppHandle) -> Result<(), String> {
    let (editor, terminal) = {
        let config = app.state::<Mutex<PrismConfig>>();
        let config = config.lock().map_err(|e| e.to_string())?;
        (config.editor.clone(), config.terminal.clone())
    };

    let config_path = PrismConfig::config_path().to_string_lossy().to_string();

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }

    let terminal_clone = terminal.clone();
    let editor_clone = editor.clone();
    let _result = tokio::task::spawn_blocking(move || {
        Command::new(&terminal_clone)
            .arg("-e")
            .arg(&editor_clone)
            .arg(&config_path)
            .status()
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e| format!("Failed to spawn {} -e {}: {}", terminal, editor, e))?;

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }

    Ok(())
}
