pub mod events;
pub mod lua_runtime;
pub mod manager;
pub mod protocol;

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
    pub entry: Option<String>,
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
