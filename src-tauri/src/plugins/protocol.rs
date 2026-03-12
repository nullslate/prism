use std::collections::HashMap;
use std::path::PathBuf;

/// Resolve a prism-plugin:// URL to file contents and MIME type.
/// Uses plugin_paths to look up the actual directory for each plugin.
pub fn resolve_plugin_asset(
    plugin_paths: &HashMap<String, PathBuf>,
    url: &str,
) -> Option<(Vec<u8>, String)> {
    // URL format: prism-plugin://localhost/plugin-name/file/path
    // or: prism-plugin://plugin-name/file/path
    let path = url.strip_prefix("prism-plugin://")?;
    // Strip "localhost/" prefix if present (Tauri sometimes adds it)
    let path = path.strip_prefix("localhost/").unwrap_or(path);

    let mut parts = path.splitn(2, '/');
    let plugin_name = parts.next()?;
    let file_path = parts.next().unwrap_or("ui/dist/index.js");

    let plugin_dir = plugin_paths.get(plugin_name)?;
    let full_path = plugin_dir.join(file_path);

    if !full_path.exists() {
        return None;
    }

    let content = std::fs::read(&full_path).ok()?;
    let mime = if file_path.ends_with(".js") {
        "application/javascript"
    } else if file_path.ends_with(".css") {
        "text/css"
    } else {
        "application/octet-stream"
    };

    Some((content, mime.to_string()))
}
