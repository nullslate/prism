use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrismConfig {
    pub vault: String,
    #[serde(default = "default_editor")]
    pub editor: String,
    #[serde(default = "default_terminal")]
    pub terminal: String,
    #[serde(default = "default_theme")]
    pub theme: String,
    #[serde(default)]
    pub window: WindowConfig,
    #[serde(default)]
    pub favorites: Vec<Favorite>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowConfig {
    #[serde(default = "default_width")]
    pub width: u32,
    #[serde(default = "default_height")]
    pub height: u32,
    #[serde(default = "default_position")]
    pub position: String,
    #[serde(default = "default_always_on_top")]
    pub always_on_top: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Favorite {
    pub path: String,
    pub label: String,
}

fn default_editor() -> String {
    std::env::var("EDITOR").unwrap_or_else(|_| "nvim".into())
}
fn default_terminal() -> String {
    "alacritty".into()
}
fn default_theme() -> String {
    "catppuccin-mocha".into()
}
fn default_width() -> u32 {
    420
}
fn default_height() -> u32 {
    700
}
fn default_position() -> String {
    "top-right".into()
}
fn default_always_on_top() -> bool {
    true
}

impl Default for WindowConfig {
    fn default() -> Self {
        Self {
            width: default_width(),
            height: default_height(),
            position: default_position(),
            always_on_top: default_always_on_top(),
        }
    }
}

impl Default for PrismConfig {
    fn default() -> Self {
        Self {
            vault: "~/obsidian".into(),
            editor: default_editor(),
            terminal: default_terminal(),
            theme: default_theme(),
            window: WindowConfig::default(),
            favorites: vec![],
        }
    }
}

impl PrismConfig {
    pub fn config_path() -> PathBuf {
        dirs::config_dir().unwrap().join("prism").join("config.toml")
    }

    pub fn load() -> Result<Self, String> {
        let path = Self::config_path();
        if !path.exists() {
            let default = Self::default();
            default.save()?;
            return Ok(default);
        }
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        toml::from_str(&content).map_err(|e| e.to_string())
    }

    pub fn save(&self) -> Result<(), String> {
        let path = Self::config_path();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let content = toml::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(&path, content).map_err(|e| e.to_string())
    }

    pub fn vault_path(&self) -> PathBuf {
        let expanded = shellexpand::tilde(&self.vault);
        PathBuf::from(expanded.as_ref())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_config() {
        let toml_str = r#"
vault = "~/obsidian"
editor = "nvim"
terminal = "alacritty"
theme = "catppuccin-mocha"

[window]
width = 420
height = 700
position = "top-right"
always_on_top = true

[[favorites]]
path = "daily/scratch.md"
label = "Scratch"
"#;
        let config: PrismConfig = toml::from_str(toml_str).unwrap();
        assert_eq!(config.vault, "~/obsidian");
        assert_eq!(config.favorites.len(), 1);
        assert_eq!(config.window.width, 420);
    }

    #[test]
    fn test_defaults() {
        let toml_str = r#"vault = "~/notes""#;
        let config: PrismConfig = toml::from_str(toml_str).unwrap();
        assert_eq!(config.theme, "catppuccin-mocha");
        assert_eq!(config.window.width, 420);
    }
}
