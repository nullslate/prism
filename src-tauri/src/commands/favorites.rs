use crate::config::{Favorite, PrismConfig};
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn toggle_favorite(
    path: String,
    label: String,
    config: State<'_, Mutex<PrismConfig>>,
) -> Result<Vec<Favorite>, String> {
    let mut config = config.lock().map_err(|e| e.to_string())?;
    if let Some(idx) = config.favorites.iter().position(|f| f.path == path) {
        config.favorites.remove(idx);
    } else {
        config.favorites.push(Favorite { path, label });
    }
    config.save()?;
    Ok(config.favorites.clone())
}
