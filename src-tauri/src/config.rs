use serde::{Deserialize, Serialize};
use std::collections::HashMap;
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
    #[serde(default = "default_inbox")]
    pub inbox: String,
    #[serde(default = "default_hotkey")]
    pub hotkey: String,
    #[serde(default)]
    pub window: WindowConfig,
    #[serde(default)]
    pub favorites: Vec<Favorite>,
    #[serde(default)]
    #[serde(skip_serializing_if = "ShortcutConfig::is_empty")]
    pub shortcuts: ShortcutConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ShortcutConfig {
    #[serde(default)]
    pub global: HashMap<String, String>,
    #[serde(default)]
    pub render: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VaultConfig {
    #[serde(default)]
    pub shortcuts: ShortcutConfig,
}

impl ShortcutConfig {
    pub fn defaults() -> Self {
        let global = HashMap::from([
            ("find-file".into(), "ctrl+f".into()),
            ("toggle-sidebar".into(), "ctrl+b".into()),
            ("command-palette".into(), "ctrl+k".into()),
            ("new-file".into(), "ctrl+n".into()),
            ("filter-tags".into(), "ctrl+t".into()),
            ("quick-capture".into(), "ctrl+.".into()),
            ("link-graph".into(), "ctrl+g".into()),
            ("cycle-theme".into(), "ctrl+shift+t".into()),
            ("vault-search".into(), "ctrl+s".into()),
            ("close-overlay".into(), "escape".into()),
        ]);
        let render = HashMap::from([
            ("page-down".into(), "ctrl+d".into()),
            ("page-up".into(), "ctrl+u".into()),
            ("quit".into(), "q".into()),
            ("scroll-down".into(), "j".into()),
            ("scroll-up".into(), "k".into()),
            ("scroll-left".into(), "h".into()),
            ("scroll-right".into(), "l".into()),
            ("goto-top".into(), "g g".into()),
            ("goto-bottom".into(), "G".into()),
            ("open-editor".into(), "n".into()),
            ("search-in-file".into(), "/".into()),
            ("trash-file".into(), "d d".into()),
            ("favorite-1".into(), "1".into()),
            ("favorite-2".into(), "2".into()),
            ("favorite-3".into(), "3".into()),
            ("favorite-4".into(), "4".into()),
            ("favorite-5".into(), "5".into()),
            ("favorite-6".into(), "6".into()),
            ("favorite-7".into(), "7".into()),
            ("favorite-8".into(), "8".into()),
            ("favorite-9".into(), "9".into()),
        ]);
        Self { global, render }
    }

    pub fn merged(defaults: &Self, system: &Self, vault: Option<&Self>) -> Self {
        let mut global = defaults.global.clone();
        for (k, v) in &system.global {
            global.insert(k.clone(), v.clone());
        }
        if let Some(v) = vault {
            for (k, val) in &v.global {
                global.insert(k.clone(), val.clone());
            }
        }

        let mut render = defaults.render.clone();
        for (k, v) in &system.render {
            render.insert(k.clone(), v.clone());
        }
        if let Some(v) = vault {
            for (k, val) in &v.render {
                render.insert(k.clone(), val.clone());
            }
        }

        Self { global, render }
    }

    pub fn is_empty(&self) -> bool {
        self.global.is_empty() && self.render.is_empty()
    }
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
fn default_inbox() -> String {
    "inbox.md".into()
}
fn default_hotkey() -> String {
    "ctrl+space".into()
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
            inbox: default_inbox(),
            hotkey: default_hotkey(),
            window: WindowConfig::default(),
            favorites: vec![],
            shortcuts: ShortcutConfig::default(),
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

    pub fn load_vault_config(&self) -> Option<VaultConfig> {
        let path = self.vault_path().join(".prism.toml");
        if !path.exists() {
            return None;
        }
        let content = fs::read_to_string(&path).ok()?;
        toml::from_str(&content).ok()
    }

    pub fn resolved_shortcuts(&self) -> ShortcutConfig {
        let defaults = ShortcutConfig::defaults();
        let vault = self.load_vault_config();
        ShortcutConfig::merged(
            &defaults,
            &self.shortcuts,
            vault.as_ref().map(|v| &v.shortcuts),
        )
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
