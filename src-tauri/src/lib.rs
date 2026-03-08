mod commands;
mod config;
mod theme;
mod watcher;

use config::PrismConfig;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config = PrismConfig::load().unwrap_or_default();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Mutex::new(config))
        .setup(|app| {
            use tauri::Manager;

            let config = app.state::<Mutex<PrismConfig>>();
            let config = config.lock().unwrap();
            let vault_path = config.vault_path();

            let config_path = PrismConfig::config_path();
            let handle = app.handle().clone();

            if vault_path.exists() {
                let watcher = watcher::start_watcher(handle, &vault_path, &config_path)
                    .expect("Failed to start file watcher");
                app.manage(watcher);
            } else {
                // Still watch config even without a vault
                let watcher = watcher::start_config_watcher(handle, &config_path)
                    .expect("Failed to start config watcher");
                app.manage(watcher);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::config::get_config,
            commands::config::set_config,
            commands::config::reload_config,
            commands::files::list_files,
            commands::files::read_file,
            commands::search::fuzzy_search,
            commands::editor::open_in_editor,
            commands::favorites::toggle_favorite,
            commands::theme::get_theme,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
