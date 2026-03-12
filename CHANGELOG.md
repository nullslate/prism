# Changelog

## [0.4.0] - 2026-03-12

### Features

- Wiki link autocomplete: type `[[` in the editor to get file and heading suggestions
- Template system: create notes from templates with variable expansion (date, title, etc.)
- Template picker dialog and daily note templates
- Plugin runtime wiring: Lua plugins now load at startup and can hook into the app lifecycle
- `file:pre-render` event dispatched through Lua plugins when rendering markdown files
- Plugin load errors surfaced as toast notifications in the frontend
- `plugin_emit` command routes frontend events through LuaRuntime dispatch

### Fixed

- Quick capture missing `onCapture` prop causing type error

### Changed

- Bumped version to 0.4.0
- Added `send` feature to mlua for thread-safe Lua instances in Tauri managed state
- Suppressed dead-code warnings across plugin modules

## [0.3.1] - 2026-03-11

### Fixed

- Plugin UI bundles now load correctly on Linux (use `scheme://localhost/` URL format instead of `http://scheme.localhost/`)
- Plugin bundles no longer crash with "require is not defined" — added require shim mapping React externals to window globals
- Fixed invalid TOML in ascii-clock plugin manifest (conflicting `ui` key definitions)
- Plugin sidebar panels render at top of sidebar instead of bottom

### Changed

- Enable devtools in release builds
- Expose React, ReactDOM, and jsx-runtime as window globals for plugin bundles
- Removed internal planning docs from tracked files

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
