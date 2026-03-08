use crate::theme;

#[tauri::command]
pub fn get_theme(name: String) -> Result<theme::Theme, String> {
    theme::load_theme(&name)
}
