# Plugin System Design

Prism plugin system with two extension types: Lua scripts for logic/events and React UI for visual extensions. Plugin manager follows lazy.nvim conventions.

## Plugin Structure

A plugin is a directory with a `plugin.toml` manifest:

```
~/.config/prism/plugins/
├── my-plugin/
│   ├── plugin.toml
│   ├── init.lua          # scripting entry point (optional)
│   └── ui/               # React UI extension (optional)
│       ├── package.json
│       ├── dist/         # pre-built bundle (committed to repo)
│       │   └── index.js
│       └── src/
│           └── index.tsx
```

### Manifest (`plugin.toml`)

```toml
[plugin]
name = "my-plugin"
version = "0.1.0"
description = "Does a thing"
min_prism = "0.3.0"       # minimum Prism version required
entry = "init.lua"        # lua entry point, omit if UI-only
ui = "ui/"                # React UI directory, omit if script-only

[plugin.hooks]
# Declares which events the plugin uses. Required for lazy loading —
# Prism registers stubs for these events without loading the plugin.
# Also serves as documentation for what the plugin touches.
events = ["file:opened", "file:saved", "file:pre-render"]

# Declares commands the plugin registers. Required for lazy loading —
# Prism shows these in the command palette as stubs before the plugin loads.
commands = [
  { id = "daily-summary", label = "Generate Daily Summary" },
]

[plugin.ui]
sidebar = true
overlay = true
```

Plugins can be Lua-only, UI-only, or both.

## Plugin Manager

Declared in `~/.config/prism/config.toml`:

```toml
vault = "~/obsidian"
editor = "nvim"
# ... existing config fields ...

[[plugins]]
name = "word-count"
path = "~/.config/prism/plugins/word-count"  # local

[[plugins]]
name = "daily-summary"
git = "https://github.com/someone/prism-daily-summary"
branch = "main"        # optional, defaults to main
enabled = true          # optional, defaults to true

[plugins.opts]
template = "## {{date}}\n\n{{summary}}"
include_tags = ["journal", "work"]
auto_open = true

[plugins.lazy]
event = "file:opened"          # load when event fires
command = "daily-summary"      # load when palette command invoked
shortcut = "ctrl+shift+d"     # load when key pressed
```

The `plugins` field is added to `PrismConfig` as `#[serde(default)] pub plugins: Vec<PluginSpec>`. The `PluginSpec` struct uses `#[serde(default)]` on all optional fields so configs without `[[plugins]]` continue to work.

### Lifecycle

**First launch / new plugin:**
1. Read `[[plugins]]` from config
2. For `git = "..."` entries, clone with `--filter=blob:none` into `~/.config/prism/plugins/{name}/`
3. Read `plugin.toml` from plugin directory
4. Check `min_prism` compatibility, warn via toast if incompatible
5. Load Lua scripts via `mlua`
6. Load UI bundles from pre-built `ui/dist/index.js`

**UI bundles are pre-built and committed to the plugin repo.** Plugin authors run the SDK build tool locally; end users never need Node.js installed. Git-sourced plugins must include `ui/dist/` in their repo.

**Subsequent launches:**
- Load from local cache, no network hit
- No auto-update

**Update flow** (command palette: "Update Plugins"):
1. `git pull` each git-sourced plugin
2. Reload all plugins (UI bundles are pre-built in repo)
3. Toast notification with count

**Uninstall:** When a `[[plugins]]` entry is removed from config, the cloned directory is left in place (similar to lazy.nvim). A "Clean Plugins" command removes directories for plugins no longer in config.

### Lock File

`~/.config/prism/plugins.lock` tracks commit hashes for git-sourced plugins:

```toml
[daily-summary]
git = "https://github.com/someone/prism-daily-summary"
commit = "a1b2c3d"
```

### Enable/Disable

```toml
[[plugins]]
name = "word-count"
path = "~/.config/prism/plugins/word-count"
enabled = false
```

## Lua Runtime

Embedded via `mlua` crate with Lua 5.4. Each plugin gets its own Lua state for isolation.

### Plugin Entry Point

`init.lua` returns a table with a `setup` function. Prism calls `setup(opts)` on load:

```lua
local prism = require("prism")

local function setup(opts)
  prism.on("file:opened", function(event)
    -- event.path, event.name, event.content
  end)

  prism.on("file:pre-render", function(event)
    -- Return modified content to transform, nil to pass through
    return event.content:gsub("TODO", "**TODO**")
  end)

  prism.on("file:saved", function(event)
    if opts.auto_notify then
      prism.toast("Saved: " .. event.name)
    end
  end)

  prism.command({
    id = "daily-summary",
    label = "Generate Daily Summary",
    shortcut = "ctrl+shift+d",
    action = function()
      local content = build_summary(opts)
      prism.write_file("daily/summary.md", content)
      prism.open_file("daily/summary.md")
    end,
  })

  prism.status({
    id = "word-count",
    align = "right",
    -- Called on file:opened and file:saved with current file info.
    -- Return a string to display, or "" to hide.
    update = function(event)
      if not event.content then return "" end
      local words = select(2, event.content:gsub("%S+", ""))
      return words .. "w"
    end,
  })
end

return { setup = setup }
```

### `opts` Mapping

TOML types map to Lua natives:
- Strings, numbers, booleans pass through directly
- Arrays become Lua tables (integer-indexed)
- Nested TOML tables become nested Lua tables

### `prism` API

| Function | Description |
|----------|-------------|
| `prism.on(event, fn)` | Subscribe to event |
| `prism.emit(event, data)` | Emit custom event |
| `prism.command(spec)` | Register palette command |
| `prism.status(spec)` | Register status bar item |
| `prism.toast(msg, level?)` | Show notification (level: "info", "error") |
| `prism.read_file(path)` | Read file from vault |
| `prism.write_file(path, content)` | Write file to vault |
| `prism.open_file(path)` | Open file in reader |
| `prism.list_files()` | List all files in vault |
| `prism.search(query)` | Fuzzy search files |
| `prism.get_config()` | Get prism config |
| `prism.get_current_file()` | Current file path + content |
| `prism.vault_path()` | Vault root path |
| `prism.log(msg)` | Debug log |

### Events

| Event | Payload | Returnable |
|-------|---------|------------|
| `file:opened` | path, name, content | no |
| `file:closed` | path, name | no |
| `file:saved` | path, name, content | no |
| `file:pre-render` | path, content | yes (transformed content) |
| `vault:changed` | path, kind (created/modified/deleted) | no |
| `app:startup` | (none) | no |
| `app:shutdown` | (none) | no |

**`file:pre-render` chaining:** When multiple plugins register for `file:pre-render`, handlers run in config declaration order (order of `[[plugins]]` entries). Each handler receives the output of the previous handler. Returning `nil` passes the content through unchanged.

Plugins can emit and listen to custom events via `prism.emit("myplugin:thing", data)` for cross-plugin communication.

### Error Handling

- If `setup()` throws, the plugin is marked as errored, a toast shows the error, and the plugin is skipped. Other plugins continue loading.
- If an event handler errors at runtime, the error is logged and a toast shown. The handler is not unregistered — subsequent events still fire it (transient errors can self-resolve).
- If a git clone fails, a toast shows the error. The plugin entry is skipped.
- If a UI bundle fails to load or throws during render, the plugin panel/overlay shows an error boundary with the plugin name and error message. The rest of the app is unaffected.

### Security Model

Permissive (Neovim model). Plugins have full filesystem and network access. User is responsible for vetting installed plugins.

## Lazy Loading

Plugins can declare triggers to defer loading. The trigger information comes from two places:
- `[plugins.lazy]` in config — declares shortcut and event triggers
- `[plugin.hooks]` in `plugin.toml` — declares command stubs (id + label) so they can appear in the palette before the plugin loads

```toml
# In config.toml
[plugins.lazy]
event = "file:opened"
shortcut = "ctrl+shift+d"

# In plugin.toml — commands need id/label for palette stubs
[plugin.hooks]
commands = [
  { id = "daily-summary", label = "Generate Daily Summary" },
]
```

**Behavior:**
- On startup, Prism reads `plugin.toml` (cheap, no Lua loaded) and registers stubs for declared commands/shortcuts/events
- When a trigger fires, the full plugin loads (Lua state created, `setup(opts)` called), then the real handler executes
- Plugins without `[plugins.lazy]` load eagerly on startup

**Bytecode caching:** Lua files are compiled to bytecode via `string.dump` and cached in `~/.config/prism/plugins/.cache/`. Subsequent loads skip parsing.

## React UI Extensions

Plugin UI is a standalone React project that builds to a JS bundle. Prism loads the bundle at runtime.

### SDK (`@prism/plugin-sdk`)

Published as an npm package. Provides themed components and hooks:

```tsx
import {
  Panel,           // Sidebar panel wrapper
  Overlay,         // Modal/overlay wrapper
  List, ListItem,  // Navigable list (keyboard-friendly)
  Input,           // Styled text input
  Button,          // Styled button
  Text,            // Themed text
  Icon,            // Icon set
  usePlugin,       // Access plugin opts, prism API
  usePluginContext, // Access vault state, current file, theme, events
} from "@prism/plugin-sdk";
```

The SDK hook is `usePluginContext` (not `usePrism`) to avoid collision with the main app's `usePrism` hook.

All SDK components inherit the active theme via CSS custom properties. Available properties (set by the main app's theme system):

- `--prism-bg`, `--prism-fg`, `--prism-accent`, `--prism-border`
- `--prism-sidebar-bg`, `--prism-heading`, `--prism-code-bg`, `--prism-selection`
- `--prism-muted`
- `--prism-syntax-*` (keyword, string, comment, function, number, operator, type, variable)

Raw theme values also available via `usePluginContext().theme`.

### UI Entry Point

```tsx
// ui/src/index.tsx
import { Panel, List, ListItem, usePluginContext } from "@prism/plugin-sdk";

export const sidebar = () => {
  const { currentFile } = usePluginContext();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (currentFile?.content) {
      setStats(computeStats(currentFile.content));
    }
  }, [currentFile]);

  return (
    <Panel title="Document Stats">
      <List>
        <ListItem label="Words" value={stats?.words} />
        <ListItem label="Reading time" value={stats?.readingTime} />
        <ListItem label="Links" value={stats?.links} />
      </List>
    </Panel>
  );
};

// Can also register overlays
export const overlay = {
  id: "stats-detail",
  label: "Document Statistics",
  component: () => <StatsDetail />,
};
```

### UI Slot Declaration

In `plugin.toml`:

```toml
[plugin.ui]
sidebar = true
overlay = true
```

### Loading

UI bundles are built to IIFE format by the SDK's esbuild config. The plugin author runs the build; the output (`ui/dist/index.js`) is committed to the repo.

At runtime, Prism loads the bundle via a custom Tauri protocol handler (`prism-plugin://plugin-name/index.js`) that serves files from the plugin's `ui/dist/` directory. The bundle is loaded via a `<script>` tag and registers its exports on a global (`window.__PRISM_PLUGINS__[pluginName]`). Prism then mounts the exported components into sidebar/overlay slots.

The plugin SDK provides React and ReactDOM as externals (shared with the main app) to keep bundles small.

### Sidebar Panel Ordering

Plugin sidebar panels render below the built-in panels (Favorites, Files, Backlinks, Outline). Multiple plugin panels render in config declaration order (`[[plugins]]` order).

### Lua + React Communication

Both sides communicate through Tauri's event system:
- **Lua -> React:** Lua calls `prism.emit("event", data)` -> Rust event bus -> `app.emit()` (Tauri) -> JS event listener
- **React -> Lua:** JS calls `invoke("plugin_emit", { event, data })` -> Rust event bus -> Lua handler
- **React subscribe:** `usePluginContext().on("myplugin:data", handler)` wraps Tauri's `listen()`

A plugin can be Lua-only, UI-only, or both.

### Shortcut Conflicts

Plugin shortcuts (registered via `prism.command({ shortcut })` or `[plugins.lazy] shortcut`) go through the existing frontend shortcut system (not the global OS-level shortcut). If a plugin shortcut conflicts with an existing app shortcut, the plugin shortcut is ignored and a warning is logged. App shortcuts always win.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│ Prism App                                               │
├──────────────────────────┬──────────────────────────────┤
│ Plugin Manager           │ Event Bus                    │
│ - reads config.toml      │ - file:opened, file:saved    │
│ - clones git plugins     │ - vault:changed              │
│ - manages plugins.lock   │ - custom plugin events       │
│ - lazy loading stubs     │ - bridges Lua <-> React      │
│ - error boundaries       │ - uses Tauri emit/listen     │
├──────────────────────────┼──────────────────────────────┤
│ Lua Runtime (mlua)       │ UI Runtime                   │
│ - per-plugin Lua state   │ - IIFE bundles via protocol  │
│ - prism API module       │ - @prism/plugin-sdk          │
│ - bytecode caching       │ - mounts into sidebar/overlay│
│ - setup(opts) lifecycle  │ - inherits theme             │
├──────────────────────────┴──────────────────────────────┤
│ Existing Prism Core                                     │
│ - vault operations, search, config, shortcuts           │
│ - markdown rendering pipeline                           │
│ - command palette, status bar, sidebar                  │
└─────────────────────────────────────────────────────────┘
```

## Files to Create/Modify

### New Crates/Packages
- `src-tauri/src/plugins/` — plugin manager, Lua runtime, event bus
- `packages/plugin-sdk/` — `@prism/plugin-sdk` npm package

### New Files (Rust)
- `src-tauri/src/plugins/mod.rs` — module root, PluginSpec/PluginManifest structs
- `src-tauri/src/plugins/manager.rs` — plugin discovery, git clone/pull, lifecycle, error handling
- `src-tauri/src/plugins/lua_runtime.rs` — mlua embedding, prism API, bytecode cache
- `src-tauri/src/plugins/events.rs` — event bus, dispatch, subscriber management, pre-render chaining
- `src-tauri/src/plugins/lazy.rs` — stub registration, deferred loading
- `src-tauri/src/plugins/protocol.rs` — custom Tauri protocol handler for serving UI bundles
- `src-tauri/src/commands/plugins.rs` — Tauri commands (list, update, enable/disable, clean, plugin_emit)

### New Files (Frontend)
- `src/lib/plugin-loader.ts` — bundle loading via protocol, component mounting
- `src/components/plugin-panel.tsx` — wrapper for plugin sidebar panels with error boundary
- `src/components/plugin-overlay.tsx` — wrapper for plugin overlays with error boundary

### Modified Files
- `src-tauri/Cargo.toml` — add `mlua` dependency
- `src-tauri/src/lib.rs` — initialize plugin system in setup, register protocol handler
- `src-tauri/src/config.rs` — add `PluginSpec` struct with opts/lazy fields, `#[serde(default)]`
- `src-tauri/src/watcher.rs` — emit plugin events for vault file changes
- `src/routes/index.tsx` — render plugin sidebar panels and overlays
- `src/components/prism-provider.tsx` — expose plugin state and commands via context
- `src/components/status-bar.tsx` — render plugin status items
- `src/components/command-palette.tsx` — include plugin-registered commands

### SDK Package (`packages/plugin-sdk/`)
- `package.json`
- `src/index.ts` — component and hook exports
- `src/components/` — Panel, Overlay, List, ListItem, Input, Button, Text, Icon
- `src/hooks/usePlugin.ts` — access plugin opts
- `src/hooks/usePluginContext.ts` — access vault state, current file, theme, events
- `src/types.ts` — shared type definitions
- `build.js` — esbuild config (IIFE output, React/ReactDOM external)
