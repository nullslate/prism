use crate::config::{PrismConfig, ShortcutConfig};
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn get_config(config: State<'_, Mutex<PrismConfig>>) -> Result<PrismConfig, String> {
    let config = config.lock().map_err(|e| e.to_string())?;
    Ok(config.clone())
}

#[tauri::command]
pub fn get_shortcuts(config: State<'_, Mutex<PrismConfig>>) -> Result<ShortcutConfig, String> {
    let config = config.lock().map_err(|e| e.to_string())?;
    Ok(config.resolved_shortcuts())
}

#[tauri::command]
pub fn get_debug_flag(config: State<'_, Mutex<PrismConfig>>) -> Result<bool, String> {
    let config = config.lock().map_err(|e| e.to_string())?;
    Ok(config.debug)
}

#[tauri::command]
pub fn reload_config(config: State<'_, Mutex<PrismConfig>>) -> Result<PrismConfig, String> {
    let fresh = PrismConfig::load()?;
    let mut current = config.lock().map_err(|e| e.to_string())?;
    *current = fresh.clone();
    Ok(fresh)
}

#[tauri::command]
pub fn set_config(
    new_config: PrismConfig,
    config: State<'_, Mutex<PrismConfig>>,
) -> Result<(), String> {
    new_config.save()?;
    let mut current = config.lock().map_err(|e| e.to_string())?;
    *current = new_config;
    Ok(())
}
