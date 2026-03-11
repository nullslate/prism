use crate::config::PrismConfig;
use base64::{engine::general_purpose::STANDARD, Engine};
use std::fs;
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn save_image(
    filename: String,
    base64_data: String,
    config: State<'_, Mutex<PrismConfig>>,
) -> Result<String, String> {
    let config = config.lock().map_err(|e| e.to_string())?;
    let vault = config.vault_path();
    let attachments_dir = vault.join("attachments");
    fs::create_dir_all(&attachments_dir)
        .map_err(|e| format!("Failed to create attachments dir: {e}"))?;

    let target = attachments_dir.join(&filename);

    // Handle collisions
    let final_path = if !target.exists() {
        target
    } else {
        let stem = std::path::Path::new(&filename)
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let ext = std::path::Path::new(&filename)
            .extension()
            .map(|e| format!(".{}", e.to_string_lossy()))
            .unwrap_or_default();
        let mut found = None;
        for i in 1..100 {
            let candidate = attachments_dir.join(format!("{stem}-{i}{ext}"));
            if !candidate.exists() {
                found = Some(candidate);
                break;
            }
        }
        found.ok_or_else(|| "Too many files with the same name".to_string())?
    };

    let bytes = STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("Invalid base64 data: {e}"))?;
    fs::write(&final_path, bytes).map_err(|e| format!("Failed to save image: {e}"))?;

    let rel = final_path
        .strip_prefix(&vault)
        .unwrap_or(&final_path)
        .to_string_lossy()
        .to_string();
    Ok(rel)
}

#[tauri::command]
pub fn get_image(
    path: String,
    config: State<'_, Mutex<PrismConfig>>,
) -> Result<String, String> {
    let config = config.lock().map_err(|e| e.to_string())?;
    let vault = config.vault_path();
    let full_path = vault.join(&path);

    if !full_path.exists() {
        return Err(format!("Image not found: {path}"));
    }

    let bytes = fs::read(&full_path).map_err(|e| format!("Failed to read image: {e}"))?;
    let b64 = STANDARD.encode(&bytes);

    let ext = full_path
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();
    let mime = match ext.as_str() {
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "bmp" => "image/bmp",
        _ => "application/octet-stream",
    };

    Ok(format!("data:{mime};base64,{b64}"))
}
