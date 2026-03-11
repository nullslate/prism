use crate::theme;

#[tauri::command]
pub fn get_theme(name: String) -> Result<theme::Theme, String> {
    theme::load_theme(&name)
}

#[tauri::command]
pub fn list_themes() -> Vec<String> {
    let mut names: Vec<String> = theme::builtin_themes().keys().cloned().collect();

    if let Some(themes_dir) = dirs::config_dir().map(|d| d.join("prism").join("themes")) {
        if themes_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&themes_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().is_some_and(|e| e == "toml") {
                        if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
                            if !names.contains(&stem.to_string()) {
                                names.push(stem.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    names.sort();
    names
}
