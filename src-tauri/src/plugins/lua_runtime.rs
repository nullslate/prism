#![allow(dead_code)]

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
    luas: HashMap<String, Lua>,
    handlers: HashMap<String, Vec<(String, mlua::RegistryKey)>>,
    vault_path: PathBuf,
    cache_dir: PathBuf,
    command_tx: std::sync::mpsc::Sender<PluginCommand>,
    status_tx: std::sync::mpsc::Sender<(String, PluginStatusItem)>,
}

impl LuaRuntime {
    pub fn new(
        vault_path: PathBuf,
        command_tx: std::sync::mpsc::Sender<PluginCommand>,
        status_tx: std::sync::mpsc::Sender<(String, PluginStatusItem)>,
    ) -> Self {
        let cache_dir = dirs::config_dir()
            .unwrap()
            .join("prism")
            .join("plugins")
            .join(".cache");
        fs::create_dir_all(&cache_dir).ok();

        Self {
            plugins: HashMap::new(),
            luas: HashMap::new(),
            handlers: HashMap::new(),
            vault_path,
            cache_dir,
            command_tx,
            status_tx,
        }
    }

    pub fn load_plugin(
        &mut self,
        name: &str,
        plugin_dir: &Path,
        entry: &str,
        opts: &toml::Value,
    ) -> Result<(), String> {
        let lua = Lua::new();
        let entry_path = plugin_dir.join(entry);

        if !entry_path.exists() {
            return Err(format!("Entry file not found: {}", entry_path.display()));
        }

        let source = fs::read_to_string(&entry_path)
            .map_err(|e| format!("Failed to read {}: {}", entry, e))?;

        let plugin_dir_str = plugin_dir.to_string_lossy().to_string();
        lua.load(format!(
            r#"package.path = "{}/?.lua;{}/lib/?.lua;" .. package.path"#,
            plugin_dir_str, plugin_dir_str
        ))
        .exec()
        .map_err(|e| format!("Failed to set package.path: {}", e))?;

        self.register_prism_api(&lua, name)
            .map_err(|e| format!("Failed to register prism API: {}", e))?;

        let module: LuaTable = lua
            .load(&source)
            .set_name(entry)
            .eval()
            .map_err(|e| format!("Failed to load {}: {}", entry, e))?;

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

        self.luas.insert(name.to_string(), lua);
        self.collect_handlers(name);

        Ok(())
    }

    fn collect_handlers(&mut self, plugin_name: &str) {
        let entries: Vec<(String, mlua::RegistryKey)> = {
            let lua = match self.luas.get(plugin_name) {
                Some(l) => l,
                None => return,
            };
            let handlers: LuaTable = match lua.named_registry_value("__prism_on_handlers") {
                Ok(h) => h,
                Err(_) => return,
            };
            (1..=handlers.raw_len())
                .filter_map(|i| {
                    let pair: LuaTable = handlers.get(i).ok()?;
                    let event: String = pair.get(1).ok()?;
                    let reg_name: String = pair.get(2).ok()?;
                    let key = lua.named_registry_value::<mlua::RegistryKey>(&reg_name).ok()?;
                    Some((event, key))
                })
                .collect()
        };

        let name = plugin_name.to_string();
        for (event, key) in entries {
            self.handlers
                .entry(event)
                .or_default()
                .push((name.clone(), key));
        }
    }

    fn register_prism_api(
        &self,
        lua: &Lua,
        plugin_name: &str,
    ) -> LuaResult<()> {
        let prism = lua.create_table()?;
        let name = plugin_name.to_string();

        let log_name = name.clone();
        prism.set("log", lua.create_function(move |_, msg: String| {
            eprintln!("[prism:{}] {}", log_name, msg);
            Ok(())
        })?)?;

        let on_handlers = lua.create_table()?;
        lua.set_named_registry_value("__prism_on_handlers", on_handlers)?;

        let on_name = name.clone();
        prism.set("on", lua.create_function(move |lua_ctx, (event, func): (String, LuaFunction)| {
            let handlers: LuaTable = lua_ctx.named_registry_value("__prism_on_handlers")?;
            let idx = handlers.raw_len() + 1;
            let reg_name = format!("__prism_handler_{}_{}", on_name, idx);
            let key = lua_ctx.create_registry_value(func)?;
            lua_ctx.set_named_registry_value(&reg_name, key)?;
            let pair = lua_ctx.create_table()?;
            pair.set(1, event)?;
            pair.set(2, reg_name)?;
            handlers.set(idx, pair)?;
            Ok(())
        })?)?;

        prism.set("emit", lua.create_function(|_, (_event, _data): (String, Option<LuaValue>)| {
            Ok(())
        })?)?;

        let cmd_tx = self.command_tx.clone();
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

        let st_tx = self.status_tx.clone();
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

        prism.set("toast", lua.create_function(|_, (msg, _level): (String, Option<String>)| {
            eprintln!("[prism:toast] {}", msg);
            Ok(())
        })?)?;

        let vp = self.vault_path.to_string_lossy().to_string();
        prism.set("vault_path", lua.create_function(move |_, ()| {
            Ok(vp.clone())
        })?)?;

        let loaded: LuaTable = lua.globals().get::<LuaTable>("package")?.get("loaded")?;
        loaded.set("prism", prism)?;

        Ok(())
    }

    pub fn dispatch_pre_render(&self, path: &str, name: &str, content: String) -> String {
        let handlers = match self.handlers.get("file:pre-render") {
            Some(h) => h,
            None => return content,
        };

        let mut current = content;
        for (plugin_name, reg_key) in handlers {
            let lua = match self.luas.get(plugin_name) {
                Some(l) => l,
                None => continue,
            };
            let func: LuaFunction = match lua.registry_value(reg_key) {
                Ok(f) => f,
                Err(e) => {
                    eprintln!("[prism:{}] failed to get handler: {}", plugin_name, e);
                    continue;
                }
            };

            let payload = match lua.create_table() {
                Ok(t) => t,
                Err(_) => continue,
            };
            let _ = payload.set("event", "file:pre-render");
            let _ = payload.set("path", path);
            let _ = payload.set("name", name);
            let _ = payload.set("content", current.as_str());

            match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                func.call::<Option<String>>(payload)
            })) {
                Ok(Ok(Some(transformed))) => {
                    current = transformed;
                }
                Ok(Ok(None)) => {}
                Ok(Err(e)) => {
                    eprintln!("[prism:{}] file:pre-render error: {}", plugin_name, e);
                }
                Err(_) => {
                    eprintln!("[prism:{}] panicked in file:pre-render", plugin_name);
                }
            }
        }

        current
    }

    pub fn dispatch(&self, event: &str, data: Option<serde_json::Value>) {
        let handlers = match self.handlers.get(event) {
            Some(h) => h,
            None => return,
        };

        for (plugin_name, reg_key) in handlers {
            let lua = match self.luas.get(plugin_name) {
                Some(l) => l,
                None => continue,
            };
            let func: LuaFunction = match lua.registry_value(reg_key) {
                Ok(f) => f,
                Err(e) => {
                    eprintln!("[prism:{}] failed to get handler for {}: {}", plugin_name, event, e);
                    continue;
                }
            };

            let payload = match lua.create_table() {
                Ok(t) => t,
                Err(_) => continue,
            };
            let _ = payload.set("event", event);
            if let Some(ref d) = data {
                if let Ok(lua_val) = lua.to_value(d) {
                    let _ = payload.set("data", lua_val);
                }
            }

            match std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
                func.call::<()>(payload)
            })) {
                Ok(Ok(())) => {}
                Ok(Err(e)) => {
                    eprintln!("[prism:{}] error in {}: {}", plugin_name, event, e);
                }
                Err(_) => {
                    eprintln!("[prism:{}] panicked in {}", plugin_name, event);
                }
            }
        }
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
        self.luas.remove(name);
        for handlers in self.handlers.values_mut() {
            handlers.retain(|(plugin, _)| plugin != name);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_toml_to_lua_conversion() {
        let (cmd_tx, _cmd_rx) = std::sync::mpsc::channel();
        let (st_tx, _st_rx) = std::sync::mpsc::channel();
        let runtime = LuaRuntime::new(PathBuf::from("/tmp"), cmd_tx, st_tx);
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
