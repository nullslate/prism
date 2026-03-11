use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use tauri::{AppHandle, Emitter};

#[derive(Clone, Serialize)]
struct FileChangedPayload {
    path: String,
}

pub fn start_watcher(
    app: AppHandle,
    vault_path: &Path,
    config_path: &Path,
) -> Result<RecommendedWatcher, String> {
    let (tx, rx) = mpsc::channel();

    let mut watcher =
        RecommendedWatcher::new(tx, Config::default()).map_err(|e| e.to_string())?;

    watcher
        .watch(vault_path, RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    // Watch config directory (contains config.toml and themes/)
    if let Some(config_dir) = config_path.parent() {
        if config_dir.exists() {
            let _ = watcher.watch(config_dir, RecursiveMode::Recursive);
        }
    }

    let config_file = config_path.to_path_buf();
    let vault_config_file = vault_path.join(".prism.toml");

    std::thread::spawn(move || {
        while let Ok(result) = rx.recv() {
            if let Ok(Event { kind, paths, .. }) = result {
                use notify::EventKind::*;
                match kind {
                    Modify(_) | Create(_) | Remove(_) => {
                        for path in &paths {
                            if *path == config_file || *path == vault_config_file || path.starts_with(config_file.parent().unwrap_or(&PathBuf::new()).join("themes")) {
                                let _ = app.emit("config-changed", ());
                            } else if path.extension().is_some_and(|ext| ext == "md") {
                                let _ = app.emit(
                                    "file-changed",
                                    FileChangedPayload {
                                        path: path.to_string_lossy().to_string(),
                                    },
                                );
                            }
                        }
                    }
                    _ => {}
                }
            }
        }
    });

    Ok(watcher)
}

pub fn start_config_watcher(
    app: AppHandle,
    config_path: &Path,
) -> Result<RecommendedWatcher, String> {
    let (tx, rx) = mpsc::channel();

    let mut watcher =
        RecommendedWatcher::new(tx, Config::default()).map_err(|e| e.to_string())?;

    if let Some(config_dir) = config_path.parent() {
        if config_dir.exists() {
            watcher
                .watch(config_dir, RecursiveMode::Recursive)
                .map_err(|e| e.to_string())?;
        }
    }

    std::thread::spawn(move || {
        while let Ok(result) = rx.recv() {
            if let Ok(Event { kind, .. }) = result {
                use notify::EventKind::*;
                if matches!(kind, Modify(_) | Create(_)) {
                    let _ = app.emit("config-changed", ());
                }
            }
        }
    });

    Ok(watcher)
}
