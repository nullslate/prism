use crate::config::PrismConfig;
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Vec<FileNode>,
}

fn build_tree(dir: &Path, vault_root: &Path) -> Vec<FileNode> {
    let mut entries: Vec<FileNode> = Vec::new();
    let Ok(read_dir) = fs::read_dir(dir) else {
        return entries;
    };

    let mut items: Vec<_> = read_dir.filter_map(|e| e.ok()).collect();
    items.sort_by(|a, b| {
        let a_dir = a.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let b_dir = b.file_type().map(|t| t.is_dir()).unwrap_or(false);
        b_dir.cmp(&a_dir).then(a.file_name().cmp(&b.file_name()))
    });

    for entry in items {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            let children = build_tree(&path, vault_root);
            if !children.is_empty() {
                let rel = path.strip_prefix(vault_root).unwrap_or(&path);
                entries.push(FileNode {
                    name,
                    path: rel.to_string_lossy().to_string(),
                    is_dir: true,
                    children,
                });
            }
        } else if path.extension().is_some_and(|ext| ext == "md") {
            let rel = path.strip_prefix(vault_root).unwrap_or(&path);
            entries.push(FileNode {
                name,
                path: rel.to_string_lossy().to_string(),
                is_dir: false,
                children: vec![],
            });
        }
    }
    entries
}

#[tauri::command]
pub fn list_files(config: State<'_, Mutex<PrismConfig>>) -> Result<Vec<FileNode>, String> {
    let config = config.lock().map_err(|e| e.to_string())?;
    let vault = config.vault_path();
    if !vault.exists() {
        return Err(format!("Vault directory not found: {}", vault.display()));
    }
    Ok(build_tree(&vault, &vault))
}

#[tauri::command]
pub fn read_file(path: String, config: State<'_, Mutex<PrismConfig>>) -> Result<String, String> {
    let config = config.lock().map_err(|e| e.to_string())?;
    let full_path = config.vault_path().join(&path);
    fs::read_to_string(&full_path).map_err(|e| format!("Failed to read {}: {}", path, e))
}
