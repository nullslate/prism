mod commands;
mod config;
mod theme;
mod watcher;

use config::PrismConfig;
use std::sync::Mutex;
use tauri::Emitter;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

fn parse_hotkey(s: &str) -> Option<Shortcut> {
    let parts: Vec<String> = s.split('+').map(|p| p.trim().to_lowercase()).collect();
    let mut mods = Modifiers::empty();
    let mut key_str = String::new();
    for part in &parts {
        match part.as_str() {
            "ctrl" | "control" => mods |= Modifiers::CONTROL,
            "alt" => mods |= Modifiers::ALT,
            "shift" => mods |= Modifiers::SHIFT,
            "super" | "meta" | "cmd" => mods |= Modifiers::SUPER,
            other => key_str = other.to_string(),
        }
    }
    let code = match key_str.as_str() {
        "space" => Code::Space,
        "enter" | "return" => Code::Enter,
        "tab" => Code::Tab,
        "backspace" => Code::Backspace,
        "escape" | "esc" => Code::Escape,
        "a" => Code::KeyA, "b" => Code::KeyB, "c" => Code::KeyC,
        "d" => Code::KeyD, "e" => Code::KeyE, "f" => Code::KeyF,
        "g" => Code::KeyG, "h" => Code::KeyH, "i" => Code::KeyI,
        "j" => Code::KeyJ, "k" => Code::KeyK, "l" => Code::KeyL,
        "m" => Code::KeyM, "n" => Code::KeyN, "o" => Code::KeyO,
        "p" => Code::KeyP, "q" => Code::KeyQ, "r" => Code::KeyR,
        "s" => Code::KeyS, "t" => Code::KeyT, "u" => Code::KeyU,
        "v" => Code::KeyV, "w" => Code::KeyW, "x" => Code::KeyX,
        "y" => Code::KeyY, "z" => Code::KeyZ,
        "0" => Code::Digit0, "1" => Code::Digit1, "2" => Code::Digit2,
        "3" => Code::Digit3, "4" => Code::Digit4, "5" => Code::Digit5,
        "6" => Code::Digit6, "7" => Code::Digit7, "8" => Code::Digit8,
        "9" => Code::Digit9,
        _ => return None,
    };
    let mods_opt = if mods.is_empty() { None } else { Some(mods) };
    Some(Shortcut::new(mods_opt, code))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config = PrismConfig::load().unwrap_or_default();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(Mutex::new(config))
        .setup(|app| {
            use tauri::Manager;

            let config = app.state::<Mutex<PrismConfig>>();
            let config = config.lock().unwrap();
            let vault_path = config.vault_path();

            if let Some(window) = app.get_webview_window("main") {
                // Apply window config
                let win_cfg = &config.window;
                let _ = window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
                    width: win_cfg.width,
                    height: win_cfg.height,
                }));
                let _ = window.set_always_on_top(win_cfg.always_on_top);

                // Position window
                if let Ok(monitor) = window.current_monitor() {
                    if let Some(monitor) = monitor {
                        let screen = monitor.size();
                        let scale = monitor.scale_factor();
                        let w = (win_cfg.width as f64 * scale) as i32;
                        let h = (win_cfg.height as f64 * scale) as i32;
                        let sw = screen.width as i32;
                        let sh = screen.height as i32;
                        let (x, y) = match win_cfg.position.as_str() {
                            "top-left" => (0, 0),
                            "top-right" => (sw - w, 0),
                            "bottom-left" => (0, sh - h),
                            "bottom-right" => (sw - w, sh - h),
                            "center" => ((sw - w) / 2, (sh - h) / 2),
                            _ => (sw - w, 0), // default top-right
                        };
                        let _ = window.set_position(tauri::Position::Physical(
                            tauri::PhysicalPosition { x, y },
                        ));
                    }
                }

                let _ = window.show();
                let _ = window.set_focus();
            }

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

            // Register global hotkey
            let hotkey_str = config.hotkey.clone();
            drop(config); // Release lock before registering
            if let Some(shortcut) = parse_hotkey(&hotkey_str) {
                app.global_shortcut().on_shortcut(shortcut, move |app, _shortcut, _event| {
                    if let Some(window) = app.get_webview_window("main") {
                        if window.is_visible().unwrap_or(false) && window.is_focused().unwrap_or(false) {
                            let _ = window.hide();
                        } else {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("quick-capture", ());
                        }
                    }
                }).ok();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::clipboard::copy_to_clipboard,
            commands::config::get_config,
            commands::config::set_config,
            commands::config::reload_config,
            commands::config::get_shortcuts,
            commands::files::list_files,
            commands::files::read_file,
            commands::files::write_file,
            commands::files::create_file,
            commands::files::rename_file,
            commands::files::trash_file,
            commands::files::empty_trash,
            commands::files::resolve_wiki_link,
            commands::files::append_to_inbox,
            commands::files::create_daily_note,
            commands::files::get_backlinks,
            commands::search::fuzzy_search,
            commands::search::vault_search,
            commands::editor::open_in_editor,
            commands::editor::open_config_in_editor,
            commands::favorites::toggle_favorite,
            commands::theme::get_theme,
            commands::theme::list_themes,
            commands::tags::list_tags,
            commands::tags::files_for_tag,
            commands::graph::get_link_graph,
            commands::images::save_image,
            commands::images::get_image,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
