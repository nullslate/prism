use std::io::Write;
use std::process::{Command, Stdio};

#[tauri::command]
pub fn copy_to_clipboard(text: String) -> Result<(), String> {
    let mut child = Command::new("wl-copy")
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn wl-copy: {e}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(text.as_bytes())
            .map_err(|e| format!("Failed to write to wl-copy: {e}"))?;
    }

    child
        .wait()
        .map_err(|e| format!("Failed to wait for wl-copy: {e}"))?;

    Ok(())
}
