use std::path::PathBuf;

/// Resolve a prism-plugin:// URL to file contents and MIME type.
pub fn resolve_plugin_asset(
    plugins_dir: &PathBuf,
    url: &str,
) -> Option<(Vec<u8>, String)> {
    let path = url.strip_prefix("prism-plugin://")?;
    let mut parts = path.splitn(2, '/');
    let plugin_name = parts.next()?;
    let file_path = parts.next().unwrap_or("ui/dist/index.js");

    let full_path = plugins_dir.join(plugin_name).join(file_path);

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
