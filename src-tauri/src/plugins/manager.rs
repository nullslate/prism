use crate::config::PluginSpec;
use super::{PluginManifest, PluginInfo};
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
                        entry: None,
                    });
                    continue;
                }
            };

            let manifest = self.read_manifest(&plugin_dir);
            let (commands, version, description, entry) = match &manifest {
                Ok(m) => (
                    m.plugin.hooks.as_ref()
                        .map(|h| h.commands.clone())
                        .unwrap_or_default(),
                    m.plugin.version.clone(),
                    m.plugin.description.clone(),
                    m.plugin.entry.clone(),
                ),
                Err(_) => (vec![], String::new(), String::new(), None),
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
                entry,
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
