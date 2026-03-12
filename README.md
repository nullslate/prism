<div align="center">

# Prism

**A keyboard-driven markdown vault reader**

Built with Tauri 2 + React + Rust

[![Build](https://github.com/thesandybridge/prism/actions/workflows/build.yml/badge.svg)](https://github.com/thesandybridge/prism/actions/workflows/build.yml)
[![Release](https://img.shields.io/github/v/release/thesandybridge/prism?include_prereleases&label=latest)](https://github.com/thesandybridge/prism/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-linux%20%7C%20macos%20%7C%20windows-lightgrey)]()

</div>

---

Prism is a fast, minimal desktop app for reading and navigating markdown vaults. It stays out of the way as an always-on-top sidebar with vim-style keybindings, fuzzy search, wiki-style linking, and a Lua plugin system.

It reads your existing Obsidian, Logseq, or plain-markdown vault. It doesn't write to it unless you ask.

## Install

Download the latest release from [GitHub Releases](https://github.com/thesandybridge/prism/releases/latest).

| Platform | Format | Install |
|----------|--------|---------|
| macOS | `.dmg` | Open and drag to Applications |
| Windows | `.msi` | Run the installer |
| Linux (Debian/Ubuntu) | `.deb` | `sudo dpkg -i Prism_*.deb` |
| Linux (other) | `.AppImage` | `chmod +x Prism_*.AppImage && ./Prism_*.AppImage` |

> **Linux (Wayland + Nvidia):** Set `WEBKIT_DISABLE_DMABUF_RENDERER=1` if you see rendering issues.

### Build from Source

Requires [Rust](https://rustup.rs/) (stable) and [Node.js](https://nodejs.org/) (v18+).

```sh
git clone https://github.com/thesandybridge/prism.git
cd prism
npm install
npm run tauri build
```

Development mode with hot reload:

```sh
npm run tauri dev
```

## Features

| Feature | Description |
|---------|-------------|
| **Fuzzy search** | File names, paths, and content ranked by score (`Ctrl+F`) |
| **Wiki links** | `[[note]]`, `[[path/note]]`, `[[note\|display text]]`, `[[note#heading]]` with autocomplete |
| **Tags** | Extracted from frontmatter and inline `#tags`, filterable (`Ctrl+T`) |
| **Quick capture** | Append timestamped bullets to your inbox (`Ctrl+.`) |
| **Backlinks** | Sidebar shows all files linking to the current note |
| **Vault search** | Full-text search with line-number context (`Ctrl+S`) |
| **Link graph** | Text-based interactive graph explorer (`Ctrl+G`) |
| **Daily notes** | Create/open today's note from the command palette |
| **Templates** | Create notes from templates with `{{date}}`, `{{title}}` variable expansion |
| **Outline** | Heading tree in sidebar, click to jump |
| **Vim keybindings** | `j/k` scroll, `gg/G` top/bottom, `/` search, `n` open editor |
| **Editor handoff** | Press `n` to open in your `$EDITOR`, auto-reload on return |
| **Plugins** | Lua scripting + React UI extensions |
| **Themes** | 3 built-in (catppuccin-mocha, gruvbox-dark, tokyo-night) + custom TOML themes |
| **Global hotkey** | Toggle window from any app (`Ctrl+Space`, configurable) |
| **Command palette** | `Ctrl+K` for everything |

## Configuration

Config lives at `~/.config/prism/config.toml` (created on first launch):

```toml
vault = "~/obsidian"
editor = "nvim"
terminal = "alacritty"
theme = "catppuccin-mocha"
inbox = "inbox.md"
hotkey = "ctrl+space"

[window]
width = 420
height = 700
position = "top-right"
always_on_top = true
```

Open your config from within Prism: `Ctrl+K` > "Open Config".

### Shortcuts

All keyboard shortcuts are configurable. Override defaults in config:

```toml
[shortcuts.global]
find-file = "ctrl+p"

[shortcuts.render]
quit = "ctrl+q"
```

Per-vault overrides via `.prism.toml` in your vault root. Set a value to `""` to disable.

### Themes

Custom themes: `~/.config/prism/themes/{name}.toml`

```toml
[colors]
bg = "#1a1b26"
fg = "#c0caf5"
accent = "#7aa2f7"
border = "#3b4261"
sidebar_bg = "#16161e"
heading = "#bb9af7"
code_bg = "#1a1b26"
selection = "#283457"
syntax_keyword = "#9d7cd8"
syntax_string = "#9ece6a"
syntax_comment = "#565f89"
syntax_function = "#7aa2f7"
syntax_number = "#ff9e64"
syntax_operator = "#89ddff"
syntax_type = "#2ac3de"
syntax_variable = "#c0caf5"
```

Then set `theme = "{name}"` in config.

## Keybindings

<details>
<summary><strong>Global</strong> (always active)</summary>

| Key | Action |
|-----|--------|
| `Ctrl+F` | Fuzzy file finder |
| `Ctrl+K` | Command palette |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+N` | New file |
| `Ctrl+T` | Filter by tag |
| `Ctrl+.` | Quick capture |
| `Ctrl+G` | Link graph |
| `Ctrl+S` | Search vault |
| `Ctrl+Shift+T` | Cycle theme |
| `Ctrl+Space` | Toggle window (global) |
| `Escape` | Close overlay |

</details>

<details>
<summary><strong>Render mode</strong> (reading)</summary>

| Key | Action |
|-----|--------|
| `j` / `k` | Scroll down / up |
| `Ctrl+D` / `Ctrl+U` | Half-page down / up |
| `gg` | Scroll to top |
| `G` | Scroll to bottom |
| `n` | Open editor |
| `/` | Search in file |
| `dd` | Trash file (press twice) |
| `1`-`9` | Open favorite |
| `q` | Quit |

</details>

<details>
<summary><strong>Editor mode</strong> (CodeMirror + Vim)</summary>

| Key | Action |
|-----|--------|
| `:w` | Save |
| `:q` | Exit editor |
| `:wq` | Save and exit |
| `Space y` | Yank selection |
| `Space yy` | Yank line |
| `[[` | Wiki link autocomplete |

</details>

## Plugins

Prism supports Lua scripts and React UI extensions.

```toml
[[plugins]]
name = "word-count"
path = "~/.config/prism/plugins/word-count"

[[plugins]]
name = "daily-summary"
git = "https://github.com/someone/prism-daily-summary"

[plugins.opts]
template = "## {{date}}"
```

Plugins can register commands, add status bar items, listen to events (`file:pre-render`, `file:opened`, etc.), transform content before rendering, and add sidebar panels.

Each plugin has a `plugin.toml` manifest and an `init.lua` entry point. See `test-plugins/hello-world/` for a working example.

Plugin authors can use `@prism/plugin-sdk` for themed React components.

## Project Structure

```
prism/
├── src-tauri/           # Rust backend
│   └── src/
│       ├── lib.rs       # App entry, plugin init, global hotkey
│       ├── config.rs    # TOML config
│       ├── watcher.rs   # File system watcher
│       ├── theme.rs     # Theme loading
│       ├── commands/    # Tauri IPC commands
│       └── plugins/     # Plugin manager, Lua runtime, event bus
├── src/                 # React frontend
│   ├── routes/          # Main view
│   ├── components/      # UI components
│   ├── hooks/           # State and shortcuts
│   └── lib/             # Tauri bindings, types, plugin loader
├── packages/
│   └── plugin-sdk/      # @prism/plugin-sdk
└── test-plugins/        # Example plugins
```

## License

[MIT](LICENSE)
