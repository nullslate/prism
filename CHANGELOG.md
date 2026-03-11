# Changelog

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
