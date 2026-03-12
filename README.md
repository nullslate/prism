# Prism

A lightweight markdown vault reader built with Tauri 2, React, and TypeScript. Designed for keyboard-driven workflows with vim-style navigation, fuzzy search, and a minimal always-on-top window.

## Install

Download the latest release from the [GitHub Releases](https://github.com/thesandybridge/prism/releases) page.

| Platform | Format | Instructions |
|----------|--------|-------------|
| **macOS** | `.dmg` | Open the `.dmg` and drag Prism to Applications |
| **Windows** | `.msi` | Run the installer |
| **Linux (Debian/Ubuntu)** | `.deb` | `sudo dpkg -i Prism_x.x.x_amd64.deb` |
| **Linux (other)** | `.AppImage` | `chmod +x Prism_x.x.x_amd64.AppImage && ./Prism_x.x.x_amd64.AppImage` |

> **Linux (Wayland + Nvidia):** If you see rendering issues, set `WEBKIT_DISABLE_DMABUF_RENDERER=1` before launching.

### Build from Source

Requires [Rust](https://rustup.rs/) (stable) and [Node.js](https://nodejs.org/) (v18+).

```sh
git clone https://github.com/thesandybridge/prism.git
cd prism
npm install
npm run tauri build
```

The binary will be in `src-tauri/target/release/prism`.

For development:

```sh
npm run tauri dev
```

## Configuration

Prism creates a config file on first launch at `~/.config/prism/config.toml`:

```toml
vault = "~/obsidian"        # Path to your markdown vault
editor = "nvim"             # Editor for handoff (default: $EDITOR or nvim)
terminal = "alacritty"      # Terminal to spawn editor in
theme = "catppuccin-mocha"  # Theme name (builtin or custom)
inbox = "inbox.md"          # Quick capture target file
hotkey = "ctrl+space"       # Global hotkey to toggle window

[window]
width = 420
height = 700
position = "top-right"
always_on_top = true

[[favorites]]
path = "daily/scratch.md"
label = "Scratch"
```

Open your config from within Prism via the command palette (`Ctrl+K` > "Open Config").

### Keyboard Shortcuts

All keyboard shortcuts are configurable. Add a `[shortcuts.global]` or `[shortcuts.render]` section to override defaults — only specify the keys you want to change:

```toml
[shortcuts.global]
find-file = "ctrl+p"
vault-search = "ctrl+shift+f"

[shortcuts.render]
quit = "ctrl+q"
```

Set a value to `""` to disable a shortcut.

#### Per-Vault Overrides

Create `.prism.toml` in your vault root to override shortcuts for that vault only:

```toml
[shortcuts.render]
quit = "ctrl+q"
```

Merge order: built-in defaults < system config < vault overrides.

### Themes

Three builtin themes: `catppuccin-mocha`, `gruvbox-dark`, `tokyo-night`.

Custom themes go in `~/.config/prism/themes/{name}.toml` — set `theme = "{name}"` in config.

### Favorites

Add up to 9 favorites in config. Access them with `1`-`9` in render mode.

## Keybindings

All shortcuts are [configurable](#keyboard-shortcuts) via config.

### Global (always active)

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
| `Ctrl+Space` | Toggle window (global, configurable) |
| `Escape` | Close overlay |

### Render mode (reading)

| Key | Action |
|-----|--------|
| `j` / `k` | Scroll down / up |
| `h` / `l` | Scroll up / down |
| `Ctrl+D` / `Ctrl+U` | Half-page down / up |
| `g g` | Scroll to top |
| `G` | Scroll to bottom |
| `n` | Open editor |
| `/` | Search in file |
| `d d` | Move current file to trash (press twice to confirm) |
| `1`-`9` | Open favorite |
| `q` | Quit |

### Editor mode (CodeMirror + Vim)

| Key | Action |
|-----|--------|
| `:w` | Save |
| `:q` | Exit editor |
| `:wq` | Save and exit |
| `Space y` | Yank selection to clipboard |
| `Space yy` | Yank line to clipboard |

### Overlays (file finder, palette, tag filter)

| Key | Action |
|-----|--------|
| `Ctrl+J` / `Arrow Down` | Next item |
| `Ctrl+K` / `Arrow Up` | Previous item |
| `Enter` | Select |
| `Escape` | Close (or go back in tag filter) |

## Features

### Fuzzy File Search (`Ctrl+F`)

Searches file names, paths, and content using nucleo-matcher. Results ranked by score with context preview.

### Wiki-style Note Linking

Link between notes using double-bracket syntax:

```markdown
[[note-name]]
[[path/to/note]]
[[target|display text]]
```

Links resolve by exact vault-relative path first, then fall back to a vault-wide filename search. Rendered as dotted-underline links — click to navigate.

### Tags & Filtering (`Ctrl+T`)

Tags are extracted from:
- **Frontmatter**: `tags: [foo, bar]` or YAML list format
- **Inline**: `#tag` patterns in body text (outside code blocks)

The tag overlay has two phases:
1. Browse all tags sorted by count, filter by typing
2. Select a tag to see matching files, select a file to open it

`Escape` goes back from files to tags, then closes.

### Quick Capture (`Ctrl+.`)

Opens a minimal input overlay. Type a note and press `Enter` — it appends a timestamped bullet to your inbox file:

```
- 2026-03-08 14:30 — your captured text
```

Configure the target file with `inbox` in config (default: `inbox.md`). Creates the file if it doesn't exist.

### Backlinks

The sidebar shows all files that link to the currently open note via `[[wiki links]]`. Click a backlink to navigate to it.

### Vault Search (`Ctrl+S`)

Full-text search across all files in the vault. Results show file name, line number, and surrounding context.

### Link Graph (`Ctrl+G`)

Interactive text-based explorer showing connections between notes. Navigate with `j`/`k`, press `Enter` to open a linked note, `l` to explore a link's connections.

### Daily Notes

Create or open today's daily note from the command palette. Notes are stored as `daily/YYYY-MM-DD.md`.

### Outline

The sidebar shows a heading tree for the current file. Click a heading to scroll to it.

### Trash / Soft Delete

- `d d` in render mode: press twice within 2 seconds to confirm
- Hover over a file in the sidebar to reveal a trash button
- Command palette: "Move to Trash" and "Empty Trash"

Files are moved to `.trash/` inside your vault. The trash directory is hidden from the file tree and search. "Empty Trash" permanently deletes all trashed files.

### Global Hotkey

`Ctrl+Space` (configurable) toggles window visibility from any application. Set `hotkey` in config — changes require app restart.

Supported modifiers: `ctrl`, `alt`, `shift`, `super`/`meta`/`cmd`.

### Editor Handoff

Press `n` to open the current file in your configured editor. Prism hides, spawns `terminal -e editor +{line} {file}`, waits for the editor to exit, then shows the window and reloads the file.

### In-File Search (`/`)

Highlights all matches in the current file with a match counter. Navigate between matches with the overlay controls.

### Plugins

Prism supports Lua scripts and React UI extensions. Add plugins to your config:

```toml
[[plugins]]
name = "word-count"
path = "~/.config/prism/plugins/word-count"

[[plugins]]
name = "daily-summary"
git = "https://github.com/someone/prism-daily-summary"

[plugins.opts]
template = "## {{date}}"
auto_open = true

[plugins.lazy]
event = "file:opened"
```

Plugins can:
- Register commands in the command palette
- Add status bar items
- Listen to events (`file:opened`, `file:saved`, `file:pre-render`, etc.)
- Transform content before rendering
- Add sidebar panels and overlays (React UI)

Each plugin has a `plugin.toml` manifest and an optional `init.lua` entry point. See `test-plugins/hello-world/` for an example.

Plugin authors can use the `@prism/plugin-sdk` package for themed React UI components.

### Custom Themes

Create `~/.config/prism/themes/my-theme.toml`:

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

Then set `theme = "my-theme"` in config.

## Project Structure

```
prism/
├── src-tauri/
│   ├── src/
│   │   ├── lib.rs              # App entry, plugin init, global hotkey
│   │   ├── config.rs           # TOML config management
│   │   ├── watcher.rs          # File system watcher (vault + config)
│   │   ├── theme.rs            # Theme loading (builtin + custom)
│   │   ├── commands/
│   │   │   ├── files.rs        # File ops, trash, wiki link resolution, inbox
│   │   │   ├── search.rs       # Fuzzy search (nucleo-matcher)
│   │   │   ├── editor.rs       # Editor handoff, open config
│   │   │   ├── tags.rs         # Tag extraction and filtering
│   │   │   ├── config.rs       # Config get/set/reload
│   │   │   ├── clipboard.rs    # Wayland clipboard (wl-copy)
│   │   │   ├── favorites.rs    # Favorites management
│   │   │   ├── plugins.rs      # Plugin management commands
│   │   │   └── theme.rs        # Theme command
│   │   └── plugins/
│   │       ├── mod.rs          # Plugin types (PluginManifest, PluginInfo, etc.)
│   │       ├── manager.rs      # Plugin discovery, git clone/pull, lifecycle
│   │       ├── events.rs       # Event bus, pre-render chaining
│   │       ├── lua_runtime.rs  # Lua 5.4 embedding, prism API
│   │       └── protocol.rs     # prism-plugin:// protocol handler
│   ├── Cargo.toml
│   └── capabilities/
│       └── default.json
├── src/
│   ├── routes/
│   │   └── index.tsx           # Main reader view
│   ├── components/
│   │   ├── reader/
│   │   │   ├── markdown.tsx    # Markdown renderer (wiki links, themes)
│   │   │   └── source-editor.tsx # CodeMirror + Vim
│   │   ├── sidebar/
│   │   │   ├── file-tree.tsx   # Recursive file tree
│   │   │   └── favorites.tsx   # Numbered favorites
│   │   ├── search/
│   │   │   ├── file-finder.tsx # Ctrl+P fuzzy search
│   │   │   └── in-file.tsx     # In-file search overlay
│   │   ├── command-palette.tsx
│   │   ├── plugin-panel.tsx    # Plugin error boundary
│   │   ├── plugin-overlay.tsx  # Plugin overlay wrapper
│   │   ├── tag-filter.tsx
│   │   ├── quick-capture.tsx
│   │   └── new-file-dialog.tsx
│   ├── hooks/
│   │   ├── use-vault.ts       # File tree + content state
│   │   ├── use-shortcuts.ts   # Keyboard shortcut system
│   │   └── use-theme.ts       # Theme CSS variable application
│   └── lib/
│       ├── tauri.ts            # Tauri command wrappers
│       ├── types.ts            # TypeScript types
│       ├── reader-state.ts     # UI state machine
│       ├── plugin-loader.ts    # Plugin UI bundle loader
│       └── remark-wiki-links.ts # [[wiki link]] remark plugin
├── packages/
│   └── plugin-sdk/             # @prism/plugin-sdk for plugin authors
├── test-plugins/
│   └── hello-world/            # Example plugin
└── package.json
```

## License

MIT
