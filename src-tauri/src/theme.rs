use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeColors {
    pub bg: String,
    pub fg: String,
    pub accent: String,
    pub border: String,
    pub sidebar_bg: String,
    pub heading: String,
    pub code_bg: String,
    pub selection: String,
    #[serde(default)]
    pub syntax_keyword: String,
    #[serde(default)]
    pub syntax_string: String,
    #[serde(default)]
    pub syntax_comment: String,
    #[serde(default)]
    pub syntax_function: String,
    #[serde(default)]
    pub syntax_number: String,
    #[serde(default)]
    pub syntax_operator: String,
    #[serde(default)]
    pub syntax_type: String,
    #[serde(default)]
    pub syntax_variable: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Theme {
    pub colors: ThemeColors,
}

pub fn builtin_themes() -> HashMap<String, Theme> {
    let mut themes = HashMap::new();
    themes.insert(
        "catppuccin-mocha".into(),
        Theme {
            colors: ThemeColors {
                bg: "#1e1e2e".into(),
                fg: "#cdd6f4".into(),
                accent: "#89b4fa".into(),
                border: "#313244".into(),
                sidebar_bg: "#181825".into(),
                heading: "#89dceb".into(),
                code_bg: "#11111b".into(),
                selection: "#45475a".into(),
                syntax_keyword: "#cba6f7".into(),
                syntax_string: "#a6e3a1".into(),
                syntax_comment: "#6c7086".into(),
                syntax_function: "#89b4fa".into(),
                syntax_number: "#fab387".into(),
                syntax_operator: "#89dceb".into(),
                syntax_type: "#f9e2af".into(),
                syntax_variable: "#f38ba8".into(),
            },
        },
    );
    themes.insert(
        "gruvbox-dark".into(),
        Theme {
            colors: ThemeColors {
                bg: "#282828".into(),
                fg: "#ebdbb2".into(),
                accent: "#83a598".into(),
                border: "#3c3836".into(),
                sidebar_bg: "#1d2021".into(),
                heading: "#8ec07c".into(),
                code_bg: "#1d2021".into(),
                selection: "#504945".into(),
                syntax_keyword: "#fb4934".into(),
                syntax_string: "#b8bb26".into(),
                syntax_comment: "#928374".into(),
                syntax_function: "#fabd2f".into(),
                syntax_number: "#d3869b".into(),
                syntax_operator: "#8ec07c".into(),
                syntax_type: "#fabd2f".into(),
                syntax_variable: "#83a598".into(),
            },
        },
    );
    themes.insert(
        "tokyo-night".into(),
        Theme {
            colors: ThemeColors {
                bg: "#1a1b26".into(),
                fg: "#c0caf5".into(),
                accent: "#7aa2f7".into(),
                border: "#292e42".into(),
                sidebar_bg: "#16161e".into(),
                heading: "#7dcfff".into(),
                code_bg: "#16161e".into(),
                selection: "#33467c".into(),
                syntax_keyword: "#bb9af7".into(),
                syntax_string: "#9ece6a".into(),
                syntax_comment: "#565f89".into(),
                syntax_function: "#7aa2f7".into(),
                syntax_number: "#ff9e64".into(),
                syntax_operator: "#89ddff".into(),
                syntax_type: "#2ac3de".into(),
                syntax_variable: "#c0caf5".into(),
            },
        },
    );
    themes
}

pub fn load_theme(name: &str) -> Result<Theme, String> {
    let custom_path = dirs::config_dir()
        .unwrap()
        .join("prism")
        .join("themes")
        .join(format!("{}.toml", name));

    if custom_path.exists() {
        let content = fs::read_to_string(&custom_path).map_err(|e| e.to_string())?;
        return toml::from_str(&content).map_err(|e| e.to_string());
    }

    builtin_themes()
        .remove(name)
        .ok_or_else(|| format!("Theme '{}' not found", name))
}
