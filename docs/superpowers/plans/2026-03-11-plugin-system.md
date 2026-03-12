# Plugin System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Lua + React plugin system to Prism with lazy.nvim-style plugin management.

**Architecture:** Two extension types — Lua scripts (embedded via `mlua`) for events, commands, and status bar items; React UI bundles for sidebar panels and overlays. Plugin manager reads `[[plugins]]` from config, clones git repos, and supports lazy loading with stubs. Event bus bridges Lua and React via Tauri's emit/listen system.

**Tech Stack:** Rust (`mlua` for Lua 5.4), Tauri 2 (custom protocol handler, events), React/TypeScript (dynamic bundle loading, `@prism/plugin-sdk`), esbuild (IIFE bundle output)

**Spec:** `docs/superpowers/specs/2026-03-11-plugin-system-design.md`

---

## File Structure

### New Files (Rust)
| File | Responsibility |
|------|---------------|
| `src-tauri/src/plugins/mod.rs` | Module root, `PluginManifest` / `PluginState` / `PluginRegistry` structs, public API |
| `src-tauri/src/plugins/manager.rs` | Plugin discovery, git clone/pull, lifecycle orchestration, lock file |
| `src-tauri/src/plugins/lua_runtime.rs` | `mlua` embedding, `prism` API module, `setup(opts)` call, bytecode cache |
| `src-tauri/src/plugins/events.rs` | Event bus — dispatch, subscriber registration, `file:pre-render` chaining |
| `src-tauri/src/plugins/lazy.rs` | Stub registration, deferred loading triggers |
| `src-tauri/src/plugins/protocol.rs` | Custom `prism-plugin://` Tauri protocol handler |
| `src-tauri/src/commands/plugins.rs` | Tauri commands: `list_plugins`, `update_plugins`, `clean_plugins`, `plugin_emit` |

### New Files (Frontend)
| File | Responsibility |
|------|---------------|
| `src/lib/plugin-loader.ts` | Load IIFE bundles via `<script>`, read `window.__PRISM_PLUGINS__`, mount components |
| `src/components/plugin-panel.tsx` | Sidebar panel wrapper with React error boundary |
| `src/components/plugin-overlay.tsx` | Overlay wrapper with React error boundary |

### New Package
| Directory | Responsibility |
|-----------|---------------|
| `packages/plugin-sdk/` | `@prism/plugin-sdk` npm package — themed components, hooks, esbuild config |

### Modified Files
| File | Changes |
|------|---------|
| `src-tauri/Cargo.toml` | Add `mlua` dependency |
| `src-tauri/src/commands/mod.rs` | Add `pub mod plugins;` |
| `src-tauri/src/lib.rs` | Init plugin system in setup, register protocol handler, register plugin commands |
| `src-tauri/src/config.rs` | Add `PluginSpec` struct, add `plugins: Vec<PluginSpec>` to `PrismConfig` |
| `src-tauri/src/watcher.rs` | Emit `plugin-event` for vault file changes |
| `src/lib/types.ts` | Add `PluginInfo`, `PluginCommand`, `PluginStatusItem` types |
| `src/lib/tauri.ts` | Add plugin commands (`listPlugins`, `updatePlugins`, `pluginEmit`, etc.) |
| `src/lib/reader-state.ts` | Add dynamic overlay type support for plugin overlays |
| `src/components/prism-provider.tsx` | Load plugin state, expose via context |
| `src/components/status-bar.tsx` | Render plugin status items |
| `src/components/command-palette.tsx` | Accept external commands array (plugin commands) |
| `src/routes/index.tsx` | Render plugin sidebar panels, plugin overlays, merge plugin commands into palette |

---

## Chunk 1: Core Infrastructure (Rust)

### Task 1: Add mlua dependency and plugin config types

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/config.rs`

- [ ] **Step 1: Add mlua to Cargo.toml**

Add to `[dependencies]` in `src-tauri/Cargo.toml`:
```toml
mlua = { version = "0.10", features = ["lua54", "serialize"] }
```

- [ ] **Step 2: Add PluginSpec and related structs to config.rs**

Add after the `VaultConfig` struct in `src-tauri/src/config.rs`:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginSpec {
    pub name: String,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub git: Option<String>,
    #[serde(default = "default_branch")]
    pub branch: String,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
    #[serde(default)]
    pub opts: toml::Value,
    #[serde(default)]
    pub lazy: Option<LazySpec>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LazySpec {
    #[serde(default)]
    pub event: Option<String>,
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub shortcut: Option<String>,
}

fn default_branch() -> String {
    "main".into()
}

fn default_enabled() -> bool {
    true
}
```

Add to `PrismConfig` struct:
```rust
    #[serde(default)]
    pub plugins: Vec<PluginSpec>,
```

Add to `Default for PrismConfig`:
```rust
    plugins: vec![],
```

- [ ] **Step 3: Write test for config parsing with plugins**

Add to the `tests` module in `config.rs`:
```rust
    #[test]
    fn test_parse_plugins() {
        let toml_str = r#"
vault = "~/notes"

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
command = "daily-summary"
"#;
        let config: PrismConfig = toml::from_str(toml_str).unwrap();
        assert_eq!(config.plugins.len(), 2);
        assert_eq!(config.plugins[0].name, "word-count");
        assert!(config.plugins[0].path.is_some());
        assert_eq!(config.plugins[1].name, "daily-summary");
        assert!(config.plugins[1].git.is_some());
        assert!(config.plugins[1].lazy.is_some());
        let lazy = config.plugins[1].lazy.as_ref().unwrap();
        assert_eq!(lazy.event.as_deref(), Some("file:opened"));
        assert_eq!(lazy.command.as_deref(), Some("daily-summary"));
    }

    #[test]
    fn test_config_without_plugins() {
        let toml_str = r#"vault = "~/notes""#;
        let config: PrismConfig = toml::from_str(toml_str).unwrap();
        assert!(config.plugins.is_empty());
    }
```

- [ ] **Step 4: Run tests**

Run: `cd src-tauri && cargo test`
Expected: All tests pass including the two new plugin config tests.

- [ ] **Step 5: Commit**

```
git add src-tauri/Cargo.toml src-tauri/src/config.rs
git commit -m "feat(plugins): add mlua dependency and plugin config types"
```

---

### Task 2: Plugin module scaffold and manifest parsing

**Files:**
- Create: `src-tauri/src/plugins/mod.rs`
- Create: `src-tauri/src/plugins/manager.rs`
- Modify: `src-tauri/src/lib.rs` (add `mod plugins;`)

- [ ] **Step 1: Create plugins module root**

Create `src-tauri/src/plugins/mod.rs`:
```rust
pub mod manager;

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginManifest {
    pub plugin: PluginMeta,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMeta {
    pub name: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub min_prism: Option<String>,
    #[serde(default)]
    pub entry: Option<String>,
    #[serde(default)]
    pub ui: Option<String>,
    #[serde(default)]
    pub hooks: Option<PluginHooks>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginHooks {
    #[serde(default)]
    pub events: Vec<String>,
    #[serde(default)]
    pub commands: Vec<PluginCommandStub>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginCommandStub {
    pub id: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct PluginInfo {
    pub name: String,
    pub version: String,
    pub description: String,
    pub path: PathBuf,
    pub enabled: bool,
    pub loaded: bool,
    pub error: Option<String>,
    pub commands: Vec<PluginCommandStub>,
    pub status_items: Vec<PluginStatusItem>,
}

#[derive(Debug, Clone, Serialize)]
pub struct PluginStatusItem {
    pub id: String,
    pub plugin: String,
    pub align: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginCommand {
    pub id: String,
    pub label: String,
    pub plugin: String,
    #[serde(default)]
    pub shortcut: Option<String>,
}
```

- [ ] **Step 2: Create plugin manager with discovery and git clone**

Create `src-tauri/src/plugins/manager.rs`:
```rust
use crate::config::PluginSpec;
use super::{PluginManifest, PluginInfo, PluginStatusItem};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;
use std::fs;

pub struct PluginManager {
    pub plugins: HashMap<String, PluginInfo>,
    plugins_dir: PathBuf,
}

impl PluginManager {
    pub fn new() -> Self {
        let plugins_dir = dirs::config_dir()
            .unwrap()
            .join("prism")
            .join("plugins");
        fs::create_dir_all(&plugins_dir).ok();

        Self {
            plugins: HashMap::new(),
            plugins_dir,
        }
    }

    pub fn discover(&mut self, specs: &[PluginSpec]) {
        for spec in specs {
            if !spec.enabled {
                continue;
            }

            let plugin_dir = match self.resolve_plugin_dir(spec) {
                Ok(dir) => dir,
                Err(e) => {
                    self.plugins.insert(spec.name.clone(), PluginInfo {
                        name: spec.name.clone(),
                        version: String::new(),
                        description: String::new(),
                        path: PathBuf::new(),
                        enabled: spec.enabled,
                        loaded: false,
                        error: Some(e),
                        commands: vec![],
                        status_items: vec![],
                    });
                    continue;
                }
            };

            let manifest = self.read_manifest(&plugin_dir);
            let (commands, version, description) = match &manifest {
                Ok(m) => (
                    m.plugin.hooks.as_ref()
                        .map(|h| h.commands.clone())
                        .unwrap_or_default(),
                    m.plugin.version.clone(),
                    m.plugin.description.clone(),
                ),
                Err(_) => (vec![], String::new(), String::new()),
            };

            self.plugins.insert(spec.name.clone(), PluginInfo {
                name: spec.name.clone(),
                version,
                description,
                path: plugin_dir,
                enabled: spec.enabled,
                loaded: false,
                error: manifest.err().map(|e| e.to_string()),
                commands,
                status_items: vec![],
            });
        }
    }

    fn resolve_plugin_dir(&self, spec: &PluginSpec) -> Result<PathBuf, String> {
        if let Some(path) = &spec.path {
            let expanded = shellexpand::tilde(path);
            let dir = PathBuf::from(expanded.as_ref());
            if !dir.exists() {
                return Err(format!("Plugin directory not found: {}", path));
            }
            return Ok(dir);
        }

        if let Some(git_url) = &spec.git {
            let dir = self.plugins_dir.join(&spec.name);
            if !dir.exists() {
                self.git_clone(git_url, &spec.branch, &dir)?;
            }
            return Ok(dir);
        }

        Err("Plugin spec must have either 'path' or 'git'".into())
    }

    fn git_clone(&self, url: &str, branch: &str, dest: &PathBuf) -> Result<(), String> {
        let output = Command::new("git")
            .args(["clone", "--filter=blob:none", "--branch", branch, url])
            .arg(dest)
            .output()
            .map_err(|e| format!("Failed to run git: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("git clone failed: {}", stderr));
        }
        Ok(())
    }

    pub fn git_pull(&self, name: &str) -> Result<(), String> {
        let info = self.plugins.get(name)
            .ok_or_else(|| format!("Plugin not found: {}", name))?;

        let output = Command::new("git")
            .args(["pull"])
            .current_dir(&info.path)
            .output()
            .map_err(|e| format!("Failed to run git: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("git pull failed: {}", stderr));
        }
        Ok(())
    }

    fn read_manifest(&self, dir: &PathBuf) -> Result<PluginManifest, String> {
        let path = dir.join("plugin.toml");
        if !path.exists() {
            return Err("plugin.toml not found".into());
        }
        let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        toml::from_str(&content).map_err(|e| format!("Invalid plugin.toml: {}", e))
    }

    pub fn list(&self) -> Vec<&PluginInfo> {
        self.plugins.values().collect()
    }

    pub fn clean(&mut self, specs: &[PluginSpec]) -> Vec<String> {
        let active_names: Vec<&str> = specs.iter().map(|s| s.name.as_str()).collect();
        let mut removed = vec![];

        if let Ok(entries) = fs::read_dir(&self.plugins_dir) {
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                if name == ".cache" { continue; }
                if !active_names.contains(&name.as_str()) {
                    if fs::remove_dir_all(entry.path()).is_ok() {
                        removed.push(name.clone());
                    }
                    self.plugins.remove(&name);
                }
            }
        }

        removed
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_new_manager() {
        let mgr = PluginManager::new();
        assert!(mgr.plugins.is_empty());
    }

    #[test]
    fn test_discover_missing_path() {
        let mut mgr = PluginManager::new();
        let specs = vec![PluginSpec {
            name: "nonexistent".into(),
            path: Some("/tmp/prism-test-nonexistent-plugin".into()),
            git: None,
            branch: "main".into(),
            enabled: true,
            opts: toml::Value::Table(toml::map::Map::new()),
            lazy: None,
        }];
        mgr.discover(&specs);
        let info = mgr.plugins.get("nonexistent").unwrap();
        assert!(!info.loaded);
        assert!(info.error.is_some());
    }
}
```

- [ ] **Step 3: Register plugins module in lib.rs**

Add `mod plugins;` to the top of `src-tauri/src/lib.rs` after the other module declarations:
```rust
mod commands;
mod config;
mod plugins;
mod theme;
mod watcher;
```

- [ ] **Step 4: Run cargo check and tests**

Run: `cd src-tauri && cargo test`
Expected: Compiles and all tests pass.

- [ ] **Step 5: Commit**

```
git add src-tauri/src/plugins/ src-tauri/src/lib.rs
git commit -m "feat(plugins): plugin manager with discovery and git clone"
```

---

### Task 3: Event bus

**Files:**
- Create: `src-tauri/src/plugins/events.rs`
- Modify: `src-tauri/src/plugins/mod.rs`

- [ ] **Step 1: Create event bus**

Create `src-tauri/src/plugins/events.rs`:
```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub type EventHandler = Box<dyn Fn(&EventPayload) -> Option<String> + Send>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventPayload {
    pub event: String,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub data: Option<serde_json::Value>,
}

pub struct EventBus {
    handlers: HashMap<String, Vec<(String, EventHandler)>>,
}

impl EventBus {
    pub fn new() -> Self {
        Self {
            handlers: HashMap::new(),
        }
    }

    pub fn subscribe(&mut self, event: &str, plugin: &str, handler: EventHandler) {
        self.handlers
            .entry(event.to_string())
            .or_default()
            .push((plugin.to_string(), handler));
    }

    /// Dispatch an event. For file:pre-render, chains handlers and returns
    /// the final transformed content. For other events, returns None.
    pub fn dispatch(&self, payload: &EventPayload) -> Option<String> {
        let handlers = match self.handlers.get(&payload.event) {
            Some(h) => h,
            None => return None,
        };

        if payload.event == "file:pre-render" {
            let mut content = payload.content.clone();
            for (plugin_name, handler) in handlers {
                let mut p = payload.clone();
                p.content = content.clone();
                match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| handler(&p))) {
                    Ok(result) => {
                        if let Some(transformed) = result {
                            content = Some(transformed);
                        }
                    }
                    Err(_) => {
                        eprintln!("[prism] plugin '{}' panicked in file:pre-render", plugin_name);
                    }
                }
            }
            content
        } else {
            for (plugin_name, handler) in handlers {
                match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| handler(payload))) {
                    Ok(_) => {}
                    Err(_) => {
                        eprintln!("[prism] plugin '{}' panicked in {}", plugin_name, payload.event);
                    }
                }
            }
            None
        }
    }

    pub fn remove_plugin(&mut self, plugin: &str) {
        for handlers in self.handlers.values_mut() {
            handlers.retain(|(name, _)| name != plugin);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dispatch_no_handlers() {
        let bus = EventBus::new();
        let payload = EventPayload {
            event: "file:opened".into(),
            path: Some("/test.md".into()),
            name: Some("test.md".into()),
            content: None,
            kind: None,
            data: None,
        };
        assert!(bus.dispatch(&payload).is_none());
    }

    #[test]
    fn test_pre_render_chaining() {
        let mut bus = EventBus::new();

        bus.subscribe("file:pre-render", "plugin-a", Box::new(|p| {
            let c = p.content.as_deref().unwrap_or("");
            Some(format!("A({})", c))
        }));

        bus.subscribe("file:pre-render", "plugin-b", Box::new(|p| {
            let c = p.content.as_deref().unwrap_or("");
            Some(format!("B({})", c))
        }));

        let payload = EventPayload {
            event: "file:pre-render".into(),
            path: None,
            name: None,
            content: Some("hello".into()),
            kind: None,
            data: None,
        };

        let result = bus.dispatch(&payload);
        assert_eq!(result, Some("B(A(hello))".into()));
    }

    #[test]
    fn test_pre_render_nil_passthrough() {
        let mut bus = EventBus::new();

        bus.subscribe("file:pre-render", "plugin-a", Box::new(|_p| {
            None // pass through
        }));

        bus.subscribe("file:pre-render", "plugin-b", Box::new(|p| {
            let c = p.content.as_deref().unwrap_or("");
            Some(format!("B({})", c))
        }));

        let payload = EventPayload {
            event: "file:pre-render".into(),
            path: None,
            name: None,
            content: Some("hello".into()),
            kind: None,
            data: None,
        };

        let result = bus.dispatch(&payload);
        assert_eq!(result, Some("B(hello)".into()));
    }
}
```

- [ ] **Step 2: Add events module to mod.rs**

Add to `src-tauri/src/plugins/mod.rs`:
```rust
pub mod events;
pub mod manager;
```

- [ ] **Step 3: Run tests**

Run: `cd src-tauri && cargo test plugins`
Expected: All event bus tests pass.

- [ ] **Step 4: Commit**

```
git add src-tauri/src/plugins/events.rs src-tauri/src/plugins/mod.rs
git commit -m "feat(plugins): event bus with pre-render chaining"
```

---

### Task 4: Lua runtime with prism API

**Files:**
- Create: `src-tauri/src/plugins/lua_runtime.rs`
- Modify: `src-tauri/src/plugins/mod.rs`

- [ ] **Step 1: Create Lua runtime**

Create `src-tauri/src/plugins/lua_runtime.rs`:
```rust
use mlua::prelude::*;
use std::collections::HashMap;
use std::path::Path;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::fs;

use super::events::EventBus;
use super::{PluginCommand, PluginStatusItem};

pub struct LuaPlugin {
    pub name: String,
    pub commands: Vec<PluginCommand>,
    pub status_items: Vec<String>,
}

pub struct LuaRuntime {
    plugins: HashMap<String, LuaPlugin>,
    cache_dir: PathBuf,
}

impl LuaRuntime {
    pub fn new() -> Self {
        let cache_dir = dirs::config_dir()
            .unwrap()
            .join("prism")
            .join("plugins")
            .join(".cache");
        fs::create_dir_all(&cache_dir).ok();

        Self {
            plugins: HashMap::new(),
            cache_dir,
        }
    }

    pub fn load_plugin(
        &mut self,
        name: &str,
        plugin_dir: &Path,
        entry: &str,
        opts: &toml::Value,
        command_tx: &std::sync::mpsc::Sender<PluginCommand>,
        status_tx: &std::sync::mpsc::Sender<(String, PluginStatusItem)>,
    ) -> Result<(), String> {
        let lua = Lua::new();
        let entry_path = plugin_dir.join(entry);

        if !entry_path.exists() {
            return Err(format!("Entry file not found: {}", entry_path.display()));
        }

        let source = fs::read_to_string(&entry_path)
            .map_err(|e| format!("Failed to read {}: {}", entry, e))?;

        // Set up package.path for the plugin directory
        let plugin_dir_str = plugin_dir.to_string_lossy().to_string();
        lua.load(format!(
            r#"package.path = "{}/?.lua;{}/lib/?.lua;" .. package.path"#,
            plugin_dir_str, plugin_dir_str
        ))
        .exec()
        .map_err(|e| format!("Failed to set package.path: {}", e))?;

        // Create prism module
        self.register_prism_api(&lua, name, command_tx, status_tx)
            .map_err(|e| format!("Failed to register prism API: {}", e))?;

        // Load and execute the plugin
        let module: LuaTable = lua
            .load(&source)
            .set_name(entry)
            .eval()
            .map_err(|e| format!("Failed to load {}: {}", entry, e))?;

        // Call setup(opts)
        let setup: LuaFunction = module
            .get("setup")
            .map_err(|e| format!("Plugin must return table with setup function: {}", e))?;

        let lua_opts = self.toml_to_lua(&lua, opts)
            .map_err(|e| format!("Failed to convert opts: {}", e))?;

        setup
            .call::<()>(lua_opts)
            .map_err(|e| format!("setup() failed: {}", e))?;

        self.plugins.insert(name.to_string(), LuaPlugin {
            name: name.to_string(),
            commands: vec![],
            status_items: vec![],
        });

        Ok(())
    }

    fn register_prism_api(
        &self,
        lua: &Lua,
        plugin_name: &str,
        command_tx: &std::sync::mpsc::Sender<PluginCommand>,
        status_tx: &std::sync::mpsc::Sender<(String, PluginStatusItem)>,
    ) -> LuaResult<()> {
        let prism = lua.create_table()?;
        let name = plugin_name.to_string();

        // prism.log(msg)
        let log_name = name.clone();
        prism.set("log", lua.create_function(move |_, msg: String| {
            eprintln!("[prism:{}] {}", log_name, msg);
            Ok(())
        })?)?;

        // prism.on(event, fn) — registers handler (stub, integrated later)
        let on_name = name.clone();
        prism.set("on", lua.create_function(move |_, (event, _func): (String, LuaFunction)| {
            eprintln!("[prism:{}] registered handler for {}", on_name, event);
            Ok(())
        })?)?;

        // prism.emit(event, data) — emit custom event (stub, integrated later)
        prism.set("emit", lua.create_function(|_, (_event, _data): (String, Option<LuaValue>)| {
            Ok(())
        })?)?;

        // prism.command(spec)
        let cmd_tx = command_tx.clone();
        let cmd_name = name.clone();
        prism.set("command", lua.create_function(move |_, spec: LuaTable| {
            let id: String = spec.get("id")?;
            let label: String = spec.get("label")?;
            let shortcut: Option<String> = spec.get("shortcut").ok();

            let _ = cmd_tx.send(PluginCommand {
                id,
                label,
                plugin: cmd_name.clone(),
                shortcut,
            });
            Ok(())
        })?)?;

        // prism.status(spec)
        let st_tx = status_tx.clone();
        let st_name = name.clone();
        prism.set("status", lua.create_function(move |_, spec: LuaTable| {
            let id: String = spec.get("id")?;
            let align: String = spec.get::<String>("align").unwrap_or_else(|_| "right".into());

            let _ = st_tx.send((st_name.clone(), PluginStatusItem {
                id,
                plugin: st_name.clone(),
                align,
                text: String::new(),
            }));
            Ok(())
        })?)?;

        // prism.toast(msg, level)
        prism.set("toast", lua.create_function(|_, (msg, _level): (String, Option<String>)| {
            eprintln!("[prism:toast] {}", msg);
            Ok(())
        })?)?;

        // prism.vault_path()
        prism.set("vault_path", lua.create_function(|_, ()| {
            Ok(String::new()) // Filled in during integration
        })?)?;

        // Register as module available via require("prism")
        let loaded: LuaTable = lua.globals().get::<LuaTable>("package")?.get("loaded")?;
        loaded.set("prism", prism)?;

        Ok(())
    }

    fn toml_to_lua<'lua>(&self, lua: &'lua Lua, value: &toml::Value) -> LuaResult<LuaValue<'lua>> {
        match value {
            toml::Value::String(s) => Ok(LuaValue::String(lua.create_string(s)?)),
            toml::Value::Integer(n) => Ok(LuaValue::Integer(*n)),
            toml::Value::Float(f) => Ok(LuaValue::Number(*f)),
            toml::Value::Boolean(b) => Ok(LuaValue::Boolean(*b)),
            toml::Value::Array(arr) => {
                let table = lua.create_table()?;
                for (i, v) in arr.iter().enumerate() {
                    table.set(i + 1, self.toml_to_lua(lua, v)?)?;
                }
                Ok(LuaValue::Table(table))
            }
            toml::Value::Table(map) => {
                let table = lua.create_table()?;
                for (k, v) in map.iter() {
                    table.set(k.as_str(), self.toml_to_lua(lua, v)?)?;
                }
                Ok(LuaValue::Table(table))
            }
            toml::Value::Datetime(dt) => Ok(LuaValue::String(lua.create_string(&dt.to_string())?)),
        }
    }

    pub fn unload_plugin(&mut self, name: &str) {
        self.plugins.remove(name);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_toml_to_lua_conversion() {
        let runtime = LuaRuntime::new();
        let lua = Lua::new();

        let val = toml::Value::Table({
            let mut m = toml::map::Map::new();
            m.insert("key".into(), toml::Value::String("value".into()));
            m.insert("num".into(), toml::Value::Integer(42));
            m.insert("flag".into(), toml::Value::Boolean(true));
            m
        });

        let result = runtime.toml_to_lua(&lua, &val).unwrap();
        if let LuaValue::Table(t) = result {
            let key: String = t.get("key").unwrap();
            assert_eq!(key, "value");
            let num: i64 = t.get("num").unwrap();
            assert_eq!(num, 42);
            let flag: bool = t.get("flag").unwrap();
            assert!(flag);
        } else {
            panic!("Expected table");
        }
    }
}
```

- [ ] **Step 2: Add lua_runtime to mod.rs**

Update `src-tauri/src/plugins/mod.rs` modules:
```rust
pub mod events;
pub mod lua_runtime;
pub mod manager;
```

- [ ] **Step 3: Run cargo check and tests**

Run: `cd src-tauri && cargo test`
Expected: Compiles and all tests pass.

- [ ] **Step 4: Commit**

```
git add src-tauri/src/plugins/lua_runtime.rs src-tauri/src/plugins/mod.rs
git commit -m "feat(plugins): Lua runtime with prism API and opts conversion"
```

---

### Task 5: Plugin commands (Tauri IPC)

**Files:**
- Create: `src-tauri/src/commands/plugins.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create plugin commands**

Create `src-tauri/src/commands/plugins.rs`:
```rust
use crate::plugins::manager::PluginManager;
use crate::plugins::{PluginInfo, PluginCommand, PluginStatusItem};
use crate::config::PrismConfig;
use std::sync::Mutex;
use tauri::State;

#[tauri::command]
pub fn list_plugins(
    manager: State<'_, Mutex<PluginManager>>,
) -> Result<Vec<PluginInfo>, String> {
    let mgr = manager.lock().map_err(|e| e.to_string())?;
    Ok(mgr.list().into_iter().cloned().collect())
}

#[tauri::command]
pub fn get_plugin_commands(
    manager: State<'_, Mutex<PluginManager>>,
) -> Result<Vec<PluginCommand>, String> {
    let mgr = manager.lock().map_err(|e| e.to_string())?;
    let mut commands = vec![];
    for info in mgr.list() {
        for cmd in &info.commands {
            commands.push(PluginCommand {
                id: cmd.id.clone(),
                label: cmd.label.clone(),
                plugin: info.name.clone(),
                shortcut: None,
            });
        }
    }
    Ok(commands)
}

#[tauri::command]
pub fn get_plugin_status_items(
    manager: State<'_, Mutex<PluginManager>>,
) -> Result<Vec<PluginStatusItem>, String> {
    let mgr = manager.lock().map_err(|e| e.to_string())?;
    let mut items = vec![];
    for info in mgr.list() {
        items.extend(info.status_items.clone());
    }
    Ok(items)
}

#[tauri::command]
pub fn update_plugins(
    manager: State<'_, Mutex<PluginManager>>,
    config: State<'_, Mutex<PrismConfig>>,
) -> Result<usize, String> {
    let cfg = config.lock().map_err(|e| e.to_string())?;
    let mgr = manager.lock().map_err(|e| e.to_string())?;
    let mut count = 0;
    for spec in &cfg.plugins {
        if spec.git.is_some() {
            if mgr.git_pull(&spec.name).is_ok() {
                count += 1;
            }
        }
    }
    Ok(count)
}

#[tauri::command]
pub fn clean_plugins(
    manager: State<'_, Mutex<PluginManager>>,
    config: State<'_, Mutex<PrismConfig>>,
) -> Result<Vec<String>, String> {
    let cfg = config.lock().map_err(|e| e.to_string())?;
    let mut mgr = manager.lock().map_err(|e| e.to_string())?;
    Ok(mgr.clean(&cfg.plugins))
}

#[tauri::command]
pub fn plugin_emit(
    event: String,
    data: Option<serde_json::Value>,
) -> Result<(), String> {
    // Will integrate with event bus
    Ok(())
}
```

- [ ] **Step 2: Add plugins to command modules**

Add to `src-tauri/src/commands/mod.rs`:
```rust
pub mod plugins;
```

- [ ] **Step 3: Register commands and plugin manager in lib.rs**

In `src-tauri/src/lib.rs`, in the `run()` function after config is loaded, create the plugin manager:
```rust
    let mut plugin_manager = plugins::manager::PluginManager::new();
    plugin_manager.discover(&config.plugins);
```

Add a second `.manage()` call after the existing one:
```rust
        .manage(Mutex::new(plugin_manager))
```

Register plugin commands in `invoke_handler`:
```rust
            commands::plugins::list_plugins,
            commands::plugins::get_plugin_commands,
            commands::plugins::get_plugin_status_items,
            commands::plugins::update_plugins,
            commands::plugins::clean_plugins,
            commands::plugins::plugin_emit,
```

- [ ] **Step 4: Run cargo check**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors.

- [ ] **Step 5: Commit**

```
git add src-tauri/src/commands/plugins.rs src-tauri/src/commands/mod.rs src-tauri/src/lib.rs
git commit -m "feat(plugins): Tauri commands for plugin management"
```

---

### Task 6: Custom protocol handler for UI bundles

**Files:**
- Create: `src-tauri/src/plugins/protocol.rs`
- Modify: `src-tauri/src/plugins/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Create protocol handler**

Create `src-tauri/src/plugins/protocol.rs`:
```rust
use std::path::PathBuf;

/// Resolve a prism-plugin:// URL to file contents and MIME type.
pub fn resolve_plugin_asset(
    plugins_dir: &PathBuf,
    url: &str,
) -> Option<(Vec<u8>, String)> {
    let path = url.strip_prefix("prism-plugin://")?;
    let mut parts = path.splitn(2, '/');
    let plugin_name = parts.next()?;
    let file_path = parts.next().unwrap_or("ui/dist/index.js");

    let full_path = plugins_dir.join(plugin_name).join(file_path);

    if !full_path.exists() {
        return None;
    }

    let content = std::fs::read(&full_path).ok()?;
    let mime = if file_path.ends_with(".js") {
        "application/javascript"
    } else if file_path.ends_with(".css") {
        "text/css"
    } else {
        "application/octet-stream"
    };

    Some((content, mime.to_string()))
}
```

- [ ] **Step 2: Register protocol in lib.rs**

In the Tauri builder chain in `lib.rs`, add before `.setup()`:
```rust
        .register_asynchronous_uri_scheme_protocol("prism-plugin", |_ctx, request, responder| {
            let url = request.uri().to_string();
            let plugins_dir = dirs::config_dir()
                .unwrap()
                .join("prism")
                .join("plugins");

            std::thread::spawn(move || {
                match plugins::protocol::resolve_plugin_asset(&plugins_dir, &url) {
                    Some((body, mime)) => {
                        let response = tauri::http::Response::builder()
                            .header("Content-Type", &mime)
                            .header("Access-Control-Allow-Origin", "*")
                            .body(body)
                            .unwrap();
                        responder.respond(response);
                    }
                    None => {
                        let response = tauri::http::Response::builder()
                            .status(404)
                            .body(b"Not found".to_vec())
                            .unwrap();
                        responder.respond(response);
                    }
                }
            });
        })
```

- [ ] **Step 3: Add protocol module to mod.rs**

Update `src-tauri/src/plugins/mod.rs`:
```rust
pub mod events;
pub mod lua_runtime;
pub mod manager;
pub mod protocol;
```

- [ ] **Step 4: Run cargo check**

Run: `cd src-tauri && cargo check`
Expected: Compiles without errors.

- [ ] **Step 5: Commit**

```
git add src-tauri/src/plugins/protocol.rs src-tauri/src/plugins/mod.rs src-tauri/src/lib.rs
git commit -m "feat(plugins): custom protocol handler for UI bundles"
```

---

## Chunk 2: Frontend Integration

### Task 7: Frontend types and Tauri commands

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/tauri.ts`

- [ ] **Step 1: Add plugin types to types.ts**

Add to `src/lib/types.ts`:
```typescript
export interface PluginInfo {
  name: string;
  version: string;
  description: string;
  path: string;
  enabled: boolean;
  loaded: boolean;
  error: string | null;
  commands: PluginCommandStub[];
  status_items: PluginStatusItem[];
}

export interface PluginCommandStub {
  id: string;
  label: string;
}

export interface PluginCommand {
  id: string;
  label: string;
  plugin: string;
  shortcut: string | null;
}

export interface PluginStatusItem {
  id: string;
  plugin: string;
  align: string;
  text: string;
}
```

- [ ] **Step 2: Add plugin commands to tauri.ts**

Add import of new types and add to the `commands` object in `src/lib/tauri.ts`:
```typescript
// Add to import:
import type { ..., PluginInfo, PluginCommand, PluginStatusItem } from "./types";

// Add to commands object:
  listPlugins: () => invoke<PluginInfo[]>("list_plugins"),
  getPluginCommands: () => invoke<PluginCommand[]>("get_plugin_commands"),
  getPluginStatusItems: () => invoke<PluginStatusItem[]>("get_plugin_status_items"),
  updatePlugins: () => invoke<number>("update_plugins"),
  cleanPlugins: () => invoke<string[]>("clean_plugins"),
  pluginEmit: (event: string, data?: unknown) => invoke<void>("plugin_emit", { event, data }),
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```
git add src/lib/types.ts src/lib/tauri.ts
git commit -m "feat(plugins): frontend types and Tauri command bindings"
```

---

### Task 8: Plugin context in provider

**Files:**
- Modify: `src/components/prism-provider.tsx`

- [ ] **Step 1: Add plugin state to context**

Update imports to include new types:
```typescript
import type { Favorite, PrismConfig, ShortcutConfig, PluginCommand, PluginStatusItem } from "@/lib/types";
```

Update the context interface:
```typescript
interface PrismContextValue {
  config: PrismConfig | null;
  shortcuts: ShortcutConfig | null;
  favorites: Favorite[];
  pluginCommands: PluginCommand[];
  pluginStatusItems: PluginStatusItem[];
  toggleFavorite: (path: string, label: string) => void;
}
```

Update default context, add `pluginCommands: []` and `pluginStatusItems: []`.

Add state:
```typescript
const [pluginCommands, setPluginCommands] = useState<PluginCommand[]>([]);
const [pluginStatusItems, setPluginStatusItems] = useState<PluginStatusItem[]>([]);
```

In `loadConfig` callback, add:
```typescript
commands.getPluginCommands().then(setPluginCommands).catch(console.error);
commands.getPluginStatusItems().then(setPluginStatusItems).catch(console.error);
```

Add the same two lines in the `onConfigChanged` effect.

Update Provider value to include `pluginCommands` and `pluginStatusItems`.

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```
git add src/components/prism-provider.tsx
git commit -m "feat(plugins): expose plugin commands and status items via context"
```

---

### Task 9: Plugin commands in command palette and status bar

**Files:**
- Modify: `src/routes/index.tsx`
- Modify: `src/components/status-bar.tsx`

- [ ] **Step 1: Merge plugin commands into palette in index.tsx**

Update `usePrism()` destructuring to include `pluginCommands` and `pluginStatusItems`.

After the existing `paletteCommands` useMemo, create merged list:
```typescript
const allPaletteCommands = useMemo(() => {
  const pluginCmds = pluginCommands.map((cmd) => ({
    id: `plugin:${cmd.plugin}:${cmd.id}`,
    label: cmd.label,
    shortcut: cmd.shortcut ?? undefined,
    action: () => {
      commands.pluginEmit(`command:${cmd.id}`, undefined);
    },
  }));
  return [...paletteCommands, ...pluginCmds];
}, [paletteCommands, pluginCommands]);
```

Add "Update Plugins" and "Clean Plugins" commands to `paletteCommands` array.

Update `CommandPalette` render to use `allPaletteCommands`.

- [ ] **Step 2: Add plugin status items to status bar**

In `src/components/status-bar.tsx`, import `usePrism` and get `pluginStatusItems`.

Add plugin items in the right-side div before word count:
```tsx
{pluginStatusItems.filter(s => s.text).map((item) => (
  <span key={`${item.plugin}:${item.id}`}>{item.text}</span>
))}
```

- [ ] **Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Commit**

```
git add src/routes/index.tsx src/components/status-bar.tsx
git commit -m "feat(plugins): plugin commands in palette, status items in status bar"
```

---

### Task 10: Plugin UI panel and overlay wrappers

**Files:**
- Create: `src/lib/plugin-loader.ts`
- Create: `src/components/plugin-panel.tsx`
- Create: `src/components/plugin-overlay.tsx`

- [ ] **Step 1: Create plugin loader**

Create `src/lib/plugin-loader.ts`:
```typescript
export interface PluginUI {
  sidebar?: React.ComponentType;
  overlay?: {
    id: string;
    label: string;
    component: React.ComponentType;
  };
}

declare global {
  interface Window {
    __PRISM_PLUGINS__?: Record<string, PluginUI>;
  }
}

const loadedPlugins = new Set<string>();

export async function loadPluginBundle(pluginName: string): Promise<PluginUI | null> {
  if (!window.__PRISM_PLUGINS__) {
    window.__PRISM_PLUGINS__ = {};
  }

  if (loadedPlugins.has(pluginName)) {
    return window.__PRISM_PLUGINS__[pluginName] ?? null;
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `prism-plugin://${pluginName}/ui/dist/index.js`;
    script.setAttribute("data-plugin", pluginName);
    script.onload = () => {
      loadedPlugins.add(pluginName);
      resolve(window.__PRISM_PLUGINS__?.[pluginName] ?? null);
    };
    script.onerror = () => {
      console.error(`Failed to load UI bundle for plugin: ${pluginName}`);
      loadedPlugins.add(pluginName);
      resolve(null);
    };
    document.head.appendChild(script);
  });
}
```

- [ ] **Step 2: Create plugin panel with error boundary**

Create `src/components/plugin-panel.tsx`:
```tsx
import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  pluginName: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: string | null;
}

export class PluginErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="px-3 py-2 text-xs"
          style={{ color: "var(--prism-syntax-string)" }}
        >
          Plugin "{this.props.pluginName}" error: {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 3: Create plugin overlay wrapper**

Create `src/components/plugin-overlay.tsx`:
```tsx
import { PluginErrorBoundary } from "./plugin-panel";

interface PluginOverlayProps {
  pluginName: string;
  component: React.ComponentType;
  onClose: () => void;
}

export function PluginOverlay({ pluginName, component: OverlayComponent, onClose }: PluginOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-[28rem] rounded border shadow-lg overflow-hidden"
        style={{
          background: "var(--prism-bg)",
          borderColor: "var(--prism-border)",
        }}
      >
        <PluginErrorBoundary pluginName={pluginName}>
          <OverlayComponent />
        </PluginErrorBoundary>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```
git add src/lib/plugin-loader.ts src/components/plugin-panel.tsx src/components/plugin-overlay.tsx
git commit -m "feat(plugins): plugin UI loader, panel error boundary, overlay wrapper"
```

---

## Chunk 3: Integration & Testing

### Task 11: Wire plugin UI panels into main layout

**Files:**
- Modify: `src/routes/index.tsx`

- [ ] **Step 1: Add plugin sidebar panels to layout**

Add imports:
```typescript
import { PluginErrorBoundary } from "@/components/plugin-panel";
import { loadPluginBundle, type PluginUI } from "@/lib/plugin-loader";
```

Add state for loaded UIs:
```typescript
const [pluginUIs, setPluginUIs] = useState<Record<string, PluginUI>>({});
```

Add effect to load plugin UIs:
```typescript
useEffect(() => {
  commands.listPlugins().then((plugins) => {
    for (const plugin of plugins) {
      if (plugin.enabled) {
        loadPluginBundle(plugin.name).then((ui) => {
          if (ui) {
            setPluginUIs((prev) => ({ ...prev, [plugin.name]: ui }));
          }
        });
      }
    }
  }).catch(console.error);
}, []);
```

In sidebar `<aside>`, after `<Outline>`:
```tsx
{Object.entries(pluginUIs).map(([name, ui]) =>
  ui.sidebar ? (
    <PluginErrorBoundary key={name} pluginName={name}>
      <ui.sidebar />
    </PluginErrorBoundary>
  ) : null
)}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```
git add src/routes/index.tsx
git commit -m "feat(plugins): render plugin sidebar panels in layout"
```

---

### Task 12: Create test plugin

**Files:**
- Create: `test-plugins/hello-world/plugin.toml`
- Create: `test-plugins/hello-world/init.lua`

- [ ] **Step 1: Create test plugin manifest**

Create `test-plugins/hello-world/plugin.toml`:
```toml
[plugin]
name = "hello-world"
version = "0.1.0"
description = "Test plugin for development"
entry = "init.lua"

[plugin.hooks]
events = ["file:opened"]
commands = [
  { id = "hello", label = "Say Hello" },
]
```

- [ ] **Step 2: Create test plugin Lua script**

Create `test-plugins/hello-world/init.lua`:
```lua
local prism = require("prism")

local function setup(opts)
    local greeting = opts.greeting or "Hello from plugin!"

    prism.command({
        id = "hello",
        label = "Say Hello",
        action = function()
            prism.toast(greeting)
        end,
    })

    prism.status({
        id = "hello-status",
        align = "right",
        update = function(event)
            return "HW"
        end,
    })

    prism.on("file:opened", function(event)
        prism.log("File opened: " .. (event.name or "unknown"))
    end)

    prism.log("hello-world plugin loaded!")
end

return { setup = setup }
```

- [ ] **Step 3: Commit**

```
git add test-plugins/
git commit -m "feat(plugins): add hello-world test plugin"
```

---

### Task 13: Full build verification

- [ ] **Step 1: Run all Rust tests**

Run: `cd src-tauri && cargo test`
Expected: All tests pass.

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Build the app**

Run: `npx tauri build`
Expected: Build succeeds (ignoring AppImage failure).

- [ ] **Step 4: Test with hello-world plugin**

Add to `~/.config/prism/config.toml`:
```toml
[[plugins]]
name = "hello-world"
path = "<absolute-path-to-prism>/test-plugins/hello-world"

[plugins.opts]
greeting = "Hello from test!"
```

Launch the app. Verify:
- No crash on startup
- "Say Hello" appears in command palette
- "Update Plugins" and "Clean Unused Plugins" appear in palette

- [ ] **Step 5: Commit**

```
git add -A
git commit -m "feat(plugins): complete plugin system v1"
```

---

## Chunk 4: Plugin SDK Package

### Task 14: Create @prism/plugin-sdk

**Files:**
- Create: `packages/plugin-sdk/package.json`
- Create: `packages/plugin-sdk/tsconfig.json`
- Create: `packages/plugin-sdk/src/types.ts`
- Create: `packages/plugin-sdk/src/hooks/usePlugin.ts`
- Create: `packages/plugin-sdk/src/hooks/usePluginContext.ts`
- Create: `packages/plugin-sdk/src/components/Panel.tsx`
- Create: `packages/plugin-sdk/src/components/List.tsx`
- Create: `packages/plugin-sdk/src/components/Input.tsx`
- Create: `packages/plugin-sdk/src/components/Button.tsx`
- Create: `packages/plugin-sdk/src/components/Text.tsx`
- Create: `packages/plugin-sdk/src/components/Overlay.tsx`
- Create: `packages/plugin-sdk/src/index.ts`
- Create: `packages/plugin-sdk/build.js`

- [ ] **Step 1: Create package.json and tsconfig.json**

Create `packages/plugin-sdk/package.json`:
```json
{
  "name": "@prism/plugin-sdk",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "build-plugin": "node build.js"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "typescript": "~5.8.3",
    "esbuild": "^0.25.0",
    "@types/react": "^19.1.8"
  }
}
```

Create `packages/plugin-sdk/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "declaration": true,
    "outDir": "dist",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 2: Create types and hooks**

Create `packages/plugin-sdk/src/types.ts`:
```typescript
export interface PluginContext {
  currentFile: { path: string; name: string; content: string } | null;
  theme: Record<string, string>;
  on: (event: string, handler: (data: unknown) => void) => () => void;
}

export interface PluginOpts {
  opts: Record<string, unknown>;
}
```

Create `packages/plugin-sdk/src/hooks/usePlugin.ts`:
```typescript
import { createContext, useContext } from "react";
import type { PluginOpts } from "../types";

export const PluginOptsContext = createContext<PluginOpts>({ opts: {} });
export function usePlugin(): PluginOpts {
  return useContext(PluginOptsContext);
}
```

Create `packages/plugin-sdk/src/hooks/usePluginContext.ts`:
```typescript
import { createContext, useContext } from "react";
import type { PluginContext } from "../types";

export const PluginContextCtx = createContext<PluginContext>({
  currentFile: null,
  theme: {},
  on: () => () => {},
});

export function usePluginContext(): PluginContext {
  return useContext(PluginContextCtx);
}
```

- [ ] **Step 3: Create SDK components**

Create `packages/plugin-sdk/src/components/Panel.tsx`:
```tsx
import type { ReactNode } from "react";

interface PanelProps { title: string; children: ReactNode }

export function Panel({ title, children }: PanelProps) {
  return (
    <div className="border-t" style={{ borderColor: "var(--prism-border)" }}>
      <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest"
        style={{ color: "var(--prism-muted)" }}>{title}</div>
      <div className="px-3 pb-2">{children}</div>
    </div>
  );
}
```

Create `packages/plugin-sdk/src/components/List.tsx`:
```tsx
import type { ReactNode } from "react";

export function List({ children }: { children: ReactNode }) {
  return <ul className="space-y-0.5">{children}</ul>;
}

interface ListItemProps { label: string; value?: string | number | null; onClick?: () => void }

export function ListItem({ label, value, onClick }: ListItemProps) {
  const Tag = onClick ? "button" : "li";
  return (
    <Tag className="flex justify-between w-full px-2 py-1 text-sm rounded hover:bg-[var(--prism-selection)] cursor-default"
      style={{ color: "var(--prism-fg)" }} onClick={onClick}>
      <span>{label}</span>
      {value != null && <span style={{ color: "var(--prism-muted)" }}>{value}</span>}
    </Tag>
  );
}
```

Create `packages/plugin-sdk/src/components/Input.tsx`:
```tsx
import type { InputHTMLAttributes } from "react";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className={`w-full px-3 py-2 text-sm rounded border outline-none ${props.className ?? ""}`}
      style={{ background: "var(--prism-code-bg)", color: "var(--prism-fg)",
        borderColor: "var(--prism-border)", ...props.style }} />
  );
}
```

Create `packages/plugin-sdk/src/components/Button.tsx`:
```tsx
import type { ButtonHTMLAttributes } from "react";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props}
      className={`px-3 py-1.5 text-sm rounded ${props.className ?? ""}`}
      style={{ background: "var(--prism-accent)", color: "var(--prism-bg)", ...props.style }} />
  );
}
```

Create `packages/plugin-sdk/src/components/Text.tsx`:
```tsx
import type { HTMLAttributes } from "react";

interface TextProps extends HTMLAttributes<HTMLSpanElement> { muted?: boolean }

export function Text({ muted, style, ...props }: TextProps) {
  return <span {...props}
    style={{ color: muted ? "var(--prism-muted)" : "var(--prism-fg)", ...style }} />;
}
```

Create `packages/plugin-sdk/src/components/Overlay.tsx`:
```tsx
import type { ReactNode } from "react";

interface OverlayProps { children: ReactNode; onClose?: () => void }

export function Overlay({ children, onClose }: OverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="w-[28rem] rounded border shadow-lg overflow-hidden"
        style={{ background: "var(--prism-bg)", borderColor: "var(--prism-border)" }}>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create barrel export**

Create `packages/plugin-sdk/src/index.ts`:
```typescript
export { Panel } from "./components/Panel";
export { List, ListItem } from "./components/List";
export { Input } from "./components/Input";
export { Button } from "./components/Button";
export { Text } from "./components/Text";
export { Overlay } from "./components/Overlay";
export { usePlugin } from "./hooks/usePlugin";
export { usePluginContext } from "./hooks/usePluginContext";
export type { PluginContext, PluginOpts } from "./types";
```

- [ ] **Step 5: Create esbuild config for plugin authors**

Create `packages/plugin-sdk/build.js`:
```javascript
import { build } from "esbuild";
import { resolve } from "path";

const entryPoint = process.argv[2] || "src/index.tsx";

build({
  entryPoints: [resolve(entryPoint)],
  bundle: true,
  format: "iife",
  globalName: "__PRISM_PLUGIN_EXPORTS__",
  outfile: "dist/index.js",
  external: ["react", "react-dom"],
  jsx: "automatic",
  minify: true,
  footer: {
    js: [
      "if (!window.__PRISM_PLUGINS__) window.__PRISM_PLUGINS__ = {};",
      'const name = document.currentScript?.getAttribute("data-plugin");',
      "if (name) window.__PRISM_PLUGINS__[name] = __PRISM_PLUGIN_EXPORTS__;",
    ].join("\n"),
  },
}).catch(() => process.exit(1));
```

- [ ] **Step 6: Install deps and verify**

Run: `cd packages/plugin-sdk && npm install && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 7: Commit**

```
git add packages/plugin-sdk/
git commit -m "feat(plugins): @prism/plugin-sdk with themed components and hooks"
```

---

### Task 15: Final verification and build

- [ ] **Step 1: Run all Rust tests**

Run: `cd src-tauri && cargo test`
Expected: All tests pass.

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Full build**

Run: `npx tauri build`
Expected: Build succeeds.

- [ ] **Step 4: Commit any remaining changes**

```
git add -A
git commit -m "feat(plugins): plugin system complete"
```
