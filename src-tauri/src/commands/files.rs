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

#[tauri::command]
pub fn write_file(path: String, content: String, config: State<'_, Mutex<PrismConfig>>) -> Result<(), String> {
    let config = config.lock().map_err(|e| e.to_string())?;
    let full_path = config.vault_path().join(&path);
    fs::write(&full_path, content).map_err(|e| format!("Failed to write {}: {}", path, e))
}

#[tauri::command]
pub fn trash_file(path: String, config: State<'_, Mutex<PrismConfig>>) -> Result<(), String> {
    let config = config.lock().map_err(|e| e.to_string())?;
    let vault = config.vault_path();
    let full_path = vault.join(&path);
    if !full_path.exists() {
        return Err(format!("File not found: {path}"));
    }
    let trash_path = vault.join(".trash").join(&path);
    if let Some(parent) = trash_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create trash dir: {e}"))?;
    }
    fs::rename(&full_path, &trash_path).map_err(|e| format!("Failed to trash file: {e}"))
}

#[tauri::command]
pub fn empty_trash(config: State<'_, Mutex<PrismConfig>>) -> Result<(), String> {
    let config = config.lock().map_err(|e| e.to_string())?;
    let trash_dir = config.vault_path().join(".trash");
    if trash_dir.exists() {
        fs::remove_dir_all(&trash_dir).map_err(|e| format!("Failed to empty trash: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn resolve_wiki_link(
    target: String,
    config: State<'_, Mutex<PrismConfig>>,
) -> Result<Option<String>, String> {
    let config = config.lock().map_err(|e| e.to_string())?;
    let vault = config.vault_path();

    // Try exact path first
    let exact = vault.join(format!("{target}.md"));
    if exact.exists() {
        return Ok(Some(format!("{target}.md")));
    }

    // Walk vault for filename match
    fn find_file(dir: &Path, name: &str, vault: &Path) -> Option<String> {
        let read_dir = fs::read_dir(dir).ok()?;
        for entry in read_dir.filter_map(|e| e.ok()) {
            let path = entry.path();
            let fname = entry.file_name().to_string_lossy().to_string();
            if fname.starts_with('.') {
                continue;
            }
            if path.is_dir() {
                if let Some(found) = find_file(&path, name, vault) {
                    return Some(found);
                }
            } else if fname.eq_ignore_ascii_case(&format!("{name}.md")) {
                let rel = path.strip_prefix(vault).ok()?;
                return Some(rel.to_string_lossy().to_string());
            }
        }
        None
    }

    Ok(find_file(&vault, &target, &vault))
}

#[tauri::command]
pub fn append_to_inbox(
    text: String,
    config: State<'_, Mutex<PrismConfig>>,
) -> Result<(), String> {
    let config = config.lock().map_err(|e| e.to_string())?;
    let vault = config.vault_path();
    let inbox_path = vault.join(&config.inbox);
    if let Some(parent) = inbox_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create inbox dir: {e}"))?;
    }
    use std::fs::OpenOptions;
    use std::io::Write;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&inbox_path)
        .map_err(|e| format!("Failed to open inbox: {e}"))?;
    writeln!(file, "- {text}").map_err(|e| format!("Failed to write to inbox: {e}"))
}

/// Create a new file, creating parent directories as needed.
/// Returns the final relative path used (may differ if a collision was resolved).
#[tauri::command]
pub fn create_file(path: String, config: State<'_, Mutex<PrismConfig>>) -> Result<String, String> {
    let config = config.lock().map_err(|e| e.to_string())?;
    let vault = config.vault_path();
    let full_path = vault.join(&path);

    // Create parent directories
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directories: {e}"))?;
    }

    // Handle name collisions: append -1, -2, etc.
    if !full_path.exists() {
        fs::write(&full_path, "").map_err(|e| format!("Failed to create file: {e}"))?;
        return Ok(path);
    }

    let stem = full_path.file_stem().unwrap_or_default().to_string_lossy().to_string();
    let ext = full_path.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
    let parent = full_path.parent().unwrap();

    for i in 1..100 {
        let candidate = parent.join(format!("{stem}-{i}{ext}"));
        if !candidate.exists() {
            fs::write(&candidate, "").map_err(|e| format!("Failed to create file: {e}"))?;
            let rel = candidate.strip_prefix(&vault).unwrap_or(&candidate);
            return Ok(rel.to_string_lossy().to_string());
        }
    }

    Err("Too many files with the same name".to_string())
}
