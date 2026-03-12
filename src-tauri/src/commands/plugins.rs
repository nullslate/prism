use crate::config::PrismConfig;
use crate::plugins::manager::PluginManager;
use crate::plugins::{PluginCommand, PluginInfo, PluginStatusItem};
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn list_plugins(
    manager: State<'_, Mutex<PluginManager>>,
) -> Result<Vec<PluginInfo>, String> {
    let mgr = manager.lock().map_err(|e| e.to_string())?;
    Ok(mgr.list().into_iter().cloned().collect())
}

#[tauri::command]
pub fn get_plugin_commands(
    manager: State<'_, Mutex<PluginManager>>,
) -> Result<Vec<PluginCommand>, String> {
    let mgr = manager.lock().map_err(|e| e.to_string())?;
    let mut commands = vec![];
    for info in mgr.list() {
        for cmd in &info.commands {
            commands.push(PluginCommand {
                id: cmd.id.clone(),
                label: cmd.label.clone(),
                plugin: info.name.clone(),
                shortcut: None,
            });
        }
    }
    Ok(commands)
}

#[tauri::command]
pub fn get_plugin_status_items(
    manager: State<'_, Mutex<PluginManager>>,
) -> Result<Vec<PluginStatusItem>, String> {
    let mgr = manager.lock().map_err(|e| e.to_string())?;
    let mut items = vec![];
    for info in mgr.list() {
        items.extend(info.status_items.clone());
    }
    Ok(items)
}

#[tauri::command]
pub fn update_plugins(
    manager: State<'_, Mutex<PluginManager>>,
    config: State<'_, Mutex<PrismConfig>>,
) -> Result<usize, String> {
    let cfg = config.lock().map_err(|e| e.to_string())?;
    let mgr = manager.lock().map_err(|e| e.to_string())?;
    let mut count = 0;
    for spec in &cfg.plugins {
        if spec.git.is_some() {
            if mgr.git_pull(&spec.name).is_ok() {
                count += 1;
            }
        }
    }
    Ok(count)
}

#[tauri::command]
pub fn clean_plugins(
    manager: State<'_, Mutex<PluginManager>>,
    config: State<'_, Mutex<PrismConfig>>,
) -> Result<Vec<String>, String> {
    let cfg = config.lock().map_err(|e| e.to_string())?;
    let mut mgr = manager.lock().map_err(|e| e.to_string())?;
    Ok(mgr.clean(&cfg.plugins))
}

#[tauri::command]
pub fn plugin_emit(
    _event: String,
    _data: Option<serde_json::Value>,
) -> Result<(), String> {
    // Will integrate with event bus
    Ok(())
}
