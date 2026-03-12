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

        // Skip templates directory at vault root
        if path.is_dir() && name == "templates" && dir == vault_root {
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

#[tauri::command]
pub fn rename_file(
    old_path: String,
    new_path: String,
    config: State<'_, Mutex<PrismConfig>>,
) -> Result<String, String> {
    let config = config.lock().map_err(|e| e.to_string())?;
    let vault = config.vault_path();
    let old_full = vault.join(&old_path);
    let new_full = vault.join(&new_path);

    if !old_full.exists() {
        return Err(format!("File not found: {old_path}"));
    }
    if new_full.exists() {
        return Err(format!("File already exists: {new_path}"));
    }

    // Create parent dirs for new location
    if let Some(parent) = new_full.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directories: {e}"))?;
    }

    fs::rename(&old_full, &new_full)
        .map_err(|e| format!("Failed to rename file: {e}"))?;

    // Update wiki links in all markdown files
    let old_stem = old_full
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();
    let new_stem = new_full
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    if old_stem != new_stem {
        update_wiki_links(&vault, &old_stem, &new_stem);
    }

    Ok(new_path)
}

fn update_wiki_links(dir: &Path, old_name: &str, new_name: &str) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        let fname = entry.file_name().to_string_lossy().to_string();
        if fname.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            update_wiki_links(&path, old_name, new_name);
        } else if path.extension().is_some_and(|ext| ext == "md") {
            if let Ok(content) = fs::read_to_string(&path) {
                // Replace [[old_name]] and [[old_name|display]]
                let pattern_plain = format!("[[{}]]", old_name);
                let pattern_alias_prefix = format!("[[{}|", old_name);
                if content.contains(&pattern_plain) || content.contains(&pattern_alias_prefix) {
                    let updated = content
                        .replace(&pattern_plain, &format!("[[{}]]", new_name))
                        .replace(&pattern_alias_prefix, &format!("[[{}|", new_name));
                    let _ = fs::write(&path, updated);
                }
            }
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct BacklinkResult {
    pub path: String,
    pub name: String,
    pub context: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct TemplateMeta {
    pub name: String,
    pub path: String,
}

fn expand_template_vars(content: &str, title: &str) -> String {
    let now = chrono::Local::now();
    content
        .replace("{{title}}", title)
        .replace("{{date}}", &now.format("%Y-%m-%d").to_string())
        .replace("{{time}}", &now.format("%H:%M").to_string())
        .replace("{{datetime}}", &now.format("%Y-%m-%d %H:%M").to_string())
}

#[tauri::command]
pub fn list_templates(config: State<'_, Mutex<PrismConfig>>) -> Result<Vec<TemplateMeta>, String> {
    let config = config.lock().map_err(|e| e.to_string())?;
    let templates_dir = config.vault_path().join("templates");
    if !templates_dir.exists() {
        return Ok(vec![]);
    }
    let mut templates = Vec::new();
    let entries = fs::read_dir(&templates_dir)
        .map_err(|e| format!("Failed to read templates dir: {e}"))?;
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path.extension().is_some_and(|ext| ext == "md") {
            let name = path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            let rel = format!("templates/{}.md", name);
            templates.push(TemplateMeta { name, path: rel });
        }
    }
    templates.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(templates)
}

#[tauri::command]
pub fn create_from_template(
    template_name: String,
    dest_path: String,
    config: State<'_, Mutex<PrismConfig>>,
) -> Result<String, String> {
    let config = config.lock().map_err(|e| e.to_string())?;
    let vault = config.vault_path();

    // Read template
    let template_file = vault.join("templates").join(format!("{template_name}.md"));
    let template_content = fs::read_to_string(&template_file)
        .map_err(|e| format!("Failed to read template: {e}"))?;

    // Derive title from dest filename
    let title = Path::new(&dest_path)
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let expanded = expand_template_vars(&template_content, &title);

    // Ensure dest has .md extension
    let dest = if dest_path.ends_with(".md") {
        dest_path.clone()
    } else {
        format!("{dest_path}.md")
    };

    let full_path = vault.join(&dest);

    // Create parent directories
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directories: {e}"))?;
    }

    // Handle name collisions
    if !full_path.exists() {
        fs::write(&full_path, &expanded)
            .map_err(|e| format!("Failed to create file: {e}"))?;
        return Ok(dest);
    }

    let stem = full_path.file_stem().unwrap_or_default().to_string_lossy().to_string();
    let ext = full_path.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default();
    let parent = full_path.parent().unwrap();

    for i in 1..100 {
        let candidate = parent.join(format!("{stem}-{i}{ext}"));
        if !candidate.exists() {
            fs::write(&candidate, &expanded)
                .map_err(|e| format!("Failed to create file: {e}"))?;
            let rel = candidate.strip_prefix(&vault).unwrap_or(&candidate);
            return Ok(rel.to_string_lossy().to_string());
        }
    }

    Err("Too many files with the same name".to_string())
}

fn scan_backlinks(
    dir: &Path,
    vault: &Path,
    target_path: &str,
    target_stem: &str,
    results: &mut Vec<BacklinkResult>,
) {
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        let fname = entry.file_name().to_string_lossy().to_string();
        if fname.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            scan_backlinks(&path, vault, target_path, target_stem, results);
        } else if path.extension().is_some_and(|ext| ext == "md") {
            let rel = path
                .strip_prefix(vault)
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string();
            if rel == target_path {
                continue;
            }
            if let Ok(content) = fs::read_to_string(&path) {
                let pattern_plain = format!("[[{}]]", target_stem);
                let pattern_alias = format!("[[{}|", target_stem);
                let lower_plain = pattern_plain.to_lowercase();
                let lower_alias = pattern_alias.to_lowercase();
                for line in content.lines() {
                    let lower_line = line.to_lowercase();
                    if lower_line.contains(&lower_plain) || lower_line.contains(&lower_alias) {
                        let file_name = fname.strip_suffix(".md").unwrap_or(&fname).to_string();
                        results.push(BacklinkResult {
                            path: rel,
                            name: file_name,
                            context: line.chars().take(120).collect(),
                        });
                        break;
                    }
                }
            }
        }
    }
}

#[tauri::command]
pub fn get_backlinks(
    path: String,
    config: State<'_, Mutex<PrismConfig>>,
) -> Result<Vec<BacklinkResult>, String> {
    let config = config.lock().map_err(|e| e.to_string())?;
    let vault = config.vault_path();

    let target_stem = Path::new(&path)
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();

    let mut results = Vec::new();
    scan_backlinks(&vault, &vault, &path, &target_stem, &mut results);
    results.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(results)
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

#[tauri::command]
pub fn create_daily_note(config: State<'_, Mutex<PrismConfig>>) -> Result<String, String> {
    let config = config.lock().map_err(|e| e.to_string())?;
    let vault = config.vault_path();

    let today = chrono::Local::now().format("%Y-%m-%d").to_string();
    let rel_path = format!("daily/{}.md", today);
    let full_path = vault.join(&rel_path);

    if full_path.exists() {
        return Ok(rel_path);
    }

    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create daily dir: {e}"))?;
    }

    // Use template if available
    let template_path = vault.join("templates/daily.md");
    let content = if template_path.exists() {
        let template = fs::read_to_string(&template_path)
            .map_err(|e| format!("Failed to read daily template: {e}"))?;
        expand_template_vars(&template, &today)
    } else {
        format!("# {}\n\n", today)
    };

    fs::write(&full_path, content)
        .map_err(|e| format!("Failed to create daily note: {e}"))?;

    Ok(rel_path)
}
