use mlua::prelude::*;
use std::collections::HashMap;
use std::path::Path;
use std::path::PathBuf;
use std::fs;

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

        // Load and evaluate the plugin source
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

        // prism.on(event, fn) - registers handler (stub, integrated later)
        let on_name = name.clone();
        prism.set("on", lua.create_function(move |_, (event, _func): (String, LuaFunction)| {
            eprintln!("[prism:{}] registered handler for {}", on_name, event);
            Ok(())
        })?)?;

        // prism.emit(event, data) - emit custom event (stub, integrated later)
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

        // prism.vault_path() - returns vault root (filled in during integration)
        prism.set("vault_path", lua.create_function(|_, ()| {
            Ok(String::new())
        })?)?;

        // Register as module available via require("prism")
        let loaded: LuaTable = lua.globals().get::<LuaTable>("package")?.get("loaded")?;
        loaded.set("prism", prism)?;

        Ok(())
    }

    fn toml_to_lua(&self, lua: &Lua, value: &toml::Value) -> LuaResult<LuaValue> {
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
