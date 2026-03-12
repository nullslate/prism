# Changelog

## [0.3.0] - 2026-03-11

### Features

- Plugin system with Lua scripting (Lua 5.4 via mlua) and React UI extensions
- Plugin manager with git clone support (`[[plugins]]` in config.toml)
- Event bus with `file:pre-render` chaining for content transformation
- `prism` Lua API: `on`, `emit`, `command`, `status`, `toast`, `log`, file ops
- Custom `prism-plugin://` protocol handler for serving UI bundles
- Plugin commands appear in command palette automatically
- Plugin status items render in status bar
- Plugin sidebar panels with error boundaries
- "Update Plugins" and "Clean Unused Plugins" commands in palette
- `@prism/plugin-sdk` npm package with themed components (Panel, List, Input, Button, Text, Overlay) and hooks (usePlugin, usePluginContext)
- Hello-world test plugin for development reference

### Docs

- Plugin system design spec and implementation plan

## [0.2.1] - 2026-03-11

### Features

- Set vault folder from within the app via native folder picker (Ctrl+O or command palette)

### Fixed

- Window positioning and always-on-top now applied from config on launch
- Window size correct on HiDPI/Retina displays (use logical coordinates)

## [0.2.0] - 2026-03-11

### Features

- Configurable keyboard shortcuts via `[shortcuts.global]` and `[shortcuts.render]` tables in config.toml
- Per-vault shortcut overrides via `.prism.toml` in vault root
- Backlinks panel in sidebar showing all files that link to the current note
- Vault-wide full-text search (`Ctrl+S`) with line-number context
- Link graph explorer showing connections between notes (`Ctrl+G`)
- Daily notes command (creates/opens today's date-stamped note)
- Image support (paste images into notes, stored in vault)
- File rename/move dialog
- Outline panel in sidebar (heading tree for current file)
- Toast notifications for user feedback
- Theme cycling (`Ctrl+Shift+T`) through all available themes
- Scroll position memory (persists across file switches)
- Command palette shortcut labels update dynamically from config

## [0.1.1] - 2026-03-11

### Fixed

- Global hotkey now opens quick capture overlay instead of just toggling window visibility
- Restore last opened note on launch via localStorage persistence
- Command palette actions (e.g. quick capture) no longer clobbered by onClose overlay reset

### Changed

- Grant `contents: write` permission to GitHub Actions for release creation
