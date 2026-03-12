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
    themes.insert(
        "dracula".into(),
        Theme {
            colors: ThemeColors {
                bg: "#282a36".into(),
                fg: "#f8f8f2".into(),
                accent: "#bd93f9".into(),
                border: "#44475a".into(),
                sidebar_bg: "#21222c".into(),
                heading: "#50fa7b".into(),
                code_bg: "#21222c".into(),
                selection: "#44475a".into(),
                syntax_keyword: "#ff79c6".into(),
                syntax_string: "#f1fa8c".into(),
                syntax_comment: "#6272a4".into(),
                syntax_function: "#50fa7b".into(),
                syntax_number: "#bd93f9".into(),
                syntax_operator: "#ff79c6".into(),
                syntax_type: "#8be9fd".into(),
                syntax_variable: "#f8f8f2".into(),
            },
        },
    );
    themes.insert(
        "alucard".into(),
        Theme {
            colors: ThemeColors {
                bg: "#0a0a0f".into(),
                fg: "#e8e8e8".into(),
                accent: "#dc143c".into(),
                border: "#2a2a3a".into(),
                sidebar_bg: "#12121a".into(),
                heading: "#50fa7b".into(),
                code_bg: "#12121a".into(),
                selection: "#1a1a24".into(),
                syntax_keyword: "#dc143c".into(),
                syntax_string: "#f1fa8c".into(),
                syntax_comment: "#6272a4".into(),
                syntax_function: "#50fa7b".into(),
                syntax_number: "#bd93f9".into(),
                syntax_operator: "#ff5555".into(),
                syntax_type: "#8be9fd".into(),
                syntax_variable: "#e8e8e8".into(),
            },
        },
    );
    themes.insert(
        "nord".into(),
        Theme {
            colors: ThemeColors {
                bg: "#2e3440".into(),
                fg: "#eceff4".into(),
                accent: "#88c0d0".into(),
                border: "#4c566a".into(),
                sidebar_bg: "#2e3440".into(),
                heading: "#a3be8c".into(),
                code_bg: "#2e3440".into(),
                selection: "#3b4252".into(),
                syntax_keyword: "#81a1c1".into(),
                syntax_string: "#a3be8c".into(),
                syntax_comment: "#616e88".into(),
                syntax_function: "#88c0d0".into(),
                syntax_number: "#b48ead".into(),
                syntax_operator: "#81a1c1".into(),
                syntax_type: "#ebcb8b".into(),
                syntax_variable: "#d8dee9".into(),
            },
        },
    );
    themes.insert(
        "one-dark".into(),
        Theme {
            colors: ThemeColors {
                bg: "#282c34".into(),
                fg: "#d7dae0".into(),
                accent: "#56b6c2".into(),
                border: "#3e4451".into(),
                sidebar_bg: "#21252b".into(),
                heading: "#98c379".into(),
                code_bg: "#21252b".into(),
                selection: "#3e4451".into(),
                syntax_keyword: "#c678dd".into(),
                syntax_string: "#98c379".into(),
                syntax_comment: "#5c6370".into(),
                syntax_function: "#61afef".into(),
                syntax_number: "#d19a66".into(),
                syntax_operator: "#56b6c2".into(),
                syntax_type: "#e5c07b".into(),
                syntax_variable: "#e06c75".into(),
            },
        },
    );
    themes.insert(
        "solarized-dark".into(),
        Theme {
            colors: ThemeColors {
                bg: "#002b36".into(),
                fg: "#fdf6e3".into(),
                accent: "#b58900".into(),
                border: "#073642".into(),
                sidebar_bg: "#002b36".into(),
                heading: "#859900".into(),
                code_bg: "#002b36".into(),
                selection: "#073642".into(),
                syntax_keyword: "#859900".into(),
                syntax_string: "#2aa198".into(),
                syntax_comment: "#586e75".into(),
                syntax_function: "#268bd2".into(),
                syntax_number: "#d33682".into(),
                syntax_operator: "#cb4b16".into(),
                syntax_type: "#b58900".into(),
                syntax_variable: "#839496".into(),
            },
        },
    );
    themes.insert(
        "solarized-light".into(),
        Theme {
            colors: ThemeColors {
                bg: "#fdf6e3".into(),
                fg: "#002b36".into(),
                accent: "#b58900".into(),
                border: "#d0cabb".into(),
                sidebar_bg: "#eee8d5".into(),
                heading: "#859900".into(),
                code_bg: "#eee8d5".into(),
                selection: "#eee8d5".into(),
                syntax_keyword: "#859900".into(),
                syntax_string: "#2aa198".into(),
                syntax_comment: "#93a1a1".into(),
                syntax_function: "#268bd2".into(),
                syntax_number: "#d33682".into(),
                syntax_operator: "#cb4b16".into(),
                syntax_type: "#b58900".into(),
                syntax_variable: "#657b83".into(),
            },
        },
    );
    themes.insert(
        "prism-dark".into(),
        Theme {
            colors: ThemeColors {
                bg: "#0a0a0c".into(),
                fg: "#f0f0f0".into(),
                accent: "#e8b4d8".into(),
                border: "#2a2a30".into(),
                sidebar_bg: "#0e0e12".into(),
                heading: "#a8e8d8".into(),
                code_bg: "#0e0e12".into(),
                selection: "#1a1a1e".into(),
                syntax_keyword: "#e8b4d8".into(),
                syntax_string: "#a8e8b8".into(),
                syntax_comment: "#606068".into(),
                syntax_function: "#a8d8f8".into(),
                syntax_number: "#f8e8a0".into(),
                syntax_operator: "#a8e8d8".into(),
                syntax_type: "#f8a0a0".into(),
                syntax_variable: "#d0d0d0".into(),
            },
        },
    );
    themes.insert(
        "oil-spill".into(),
        Theme {
            colors: ThemeColors {
                bg: "#08080c".into(),
                fg: "#d8e4e8".into(),
                accent: "#4a9ca8".into(),
                border: "#242438".into(),
                sidebar_bg: "#0c0c14".into(),
                heading: "#60c878".into(),
                code_bg: "#0c0c14".into(),
                selection: "#141420".into(),
                syntax_keyword: "#4a9ca8".into(),
                syntax_string: "#60c878".into(),
                syntax_comment: "#506068".into(),
                syntax_function: "#5888d8".into(),
                syntax_number: "#c8a848".into(),
                syntax_operator: "#4a9ca8".into(),
                syntax_type: "#d85858".into(),
                syntax_variable: "#b0c4c8".into(),
            },
        },
    );
    themes.insert(
        "gruvbox-light".into(),
        Theme {
            colors: ThemeColors {
                bg: "#fbf1c7".into(),
                fg: "#282828".into(),
                accent: "#b57614".into(),
                border: "#d5c4a1".into(),
                sidebar_bg: "#f2e5bc".into(),
                heading: "#427b58".into(),
                code_bg: "#f2e5bc".into(),
                selection: "#ebdbb2".into(),
                syntax_keyword: "#9d0006".into(),
                syntax_string: "#79740e".into(),
                syntax_comment: "#928374".into(),
                syntax_function: "#b57614".into(),
                syntax_number: "#8f3f71".into(),
                syntax_operator: "#427b58".into(),
                syntax_type: "#b57614".into(),
                syntax_variable: "#076678".into(),
            },
        },
    );
    themes.insert(
        "nord-light".into(),
        Theme {
            colors: ThemeColors {
                bg: "#eceff4".into(),
                fg: "#2e3440".into(),
                accent: "#5e81ac".into(),
                border: "#c0c8d0".into(),
                sidebar_bg: "#e5e9f0".into(),
                heading: "#689d6a".into(),
                code_bg: "#e5e9f0".into(),
                selection: "#d8dee9".into(),
                syntax_keyword: "#5e81ac".into(),
                syntax_string: "#a3be8c".into(),
                syntax_comment: "#8990a0".into(),
                syntax_function: "#88c0d0".into(),
                syntax_number: "#b48ead".into(),
                syntax_operator: "#81a1c1".into(),
                syntax_type: "#d08770".into(),
                syntax_variable: "#2e3440".into(),
            },
        },
    );
    themes.insert(
        "catppuccin-latte".into(),
        Theme {
            colors: ThemeColors {
                bg: "#eff1f5".into(),
                fg: "#1e1e2e".into(),
                accent: "#8839ef".into(),
                border: "#bcc0cc".into(),
                sidebar_bg: "#e6e9ef".into(),
                heading: "#40a02b".into(),
                code_bg: "#e6e9ef".into(),
                selection: "#dce0e8".into(),
                syntax_keyword: "#8839ef".into(),
                syntax_string: "#40a02b".into(),
                syntax_comment: "#8c8fa1".into(),
                syntax_function: "#04a5e5".into(),
                syntax_number: "#fe640b".into(),
                syntax_operator: "#179299".into(),
                syntax_type: "#df8e1d".into(),
                syntax_variable: "#d20f39".into(),
            },
        },
    );
    themes.insert(
        "one-light".into(),
        Theme {
            colors: ThemeColors {
                bg: "#fafafa".into(),
                fg: "#1a1a1a".into(),
                accent: "#0184bc".into(),
                border: "#d0d0d0".into(),
                sidebar_bg: "#f0f0f0".into(),
                heading: "#50a14f".into(),
                code_bg: "#f0f0f0".into(),
                selection: "#e8e8e8".into(),
                syntax_keyword: "#a626a4".into(),
                syntax_string: "#50a14f".into(),
                syntax_comment: "#a0a1a7".into(),
                syntax_function: "#4078f2".into(),
                syntax_number: "#986801".into(),
                syntax_operator: "#0184bc".into(),
                syntax_type: "#c18401".into(),
                syntax_variable: "#e45649".into(),
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
