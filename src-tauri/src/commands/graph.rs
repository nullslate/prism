use crate::config::PrismConfig;
use regex::Regex;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct LinkGraph {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

fn collect_md_files(dir: &Path, vault: &Path, files: &mut Vec<String>) {
    let Ok(read_dir) = fs::read_dir(dir) else {
        return;
    };
    for entry in read_dir.filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            collect_md_files(&path, vault, files);
        } else if path.extension().is_some_and(|ext| ext == "md") {
            if let Ok(rel) = path.strip_prefix(vault) {
                files.push(rel.to_string_lossy().to_string());
            }
        }
    }
}

fn resolve_target(target: &str, vault: &Path, file_map: &HashMap<String, String>) -> Option<String> {
    // Try exact match: target.md
    let exact = format!("{target}.md");
    if file_map.contains_key(&exact.to_lowercase()) {
        return file_map.get(&exact.to_lowercase()).cloned();
    }

    // Try filename-only match (for nested files)
    let target_lower = format!("{}.md", target.to_lowercase());
    for (key, path) in file_map {
        let filename = key.rsplit('/').next().unwrap_or(key);
        if filename == target_lower {
            return Some(path.clone());
        }
    }

    // Try case-insensitive path match
    let _ = vault; // vault available if needed for fs checks
    None
}

#[tauri::command]
pub fn get_link_graph(config: State<'_, Mutex<PrismConfig>>) -> Result<LinkGraph, String> {
    let config = config.lock().map_err(|e| e.to_string())?;
    let vault = config.vault_path();

    if !vault.exists() {
        return Err("Vault directory not found".to_string());
    }

    let mut md_files = Vec::new();
    collect_md_files(&vault, &vault, &mut md_files);

    // Build a lookup map: lowercase path -> actual path
    let mut file_map: HashMap<String, String> = HashMap::new();
    for path in &md_files {
        file_map.insert(path.to_lowercase(), path.clone());
    }

    let wiki_link_re = Regex::new(r"\[\[([^\]|]+)(?:\|[^\]]+)?\]\]")
        .map_err(|e| e.to_string())?;

    let mut node_set: HashSet<String> = HashSet::new();
    let mut edges: Vec<GraphEdge> = Vec::new();

    // Add all files as nodes
    for path in &md_files {
        node_set.insert(path.clone());
    }

    // Extract links from each file
    for path in &md_files {
        let full_path = vault.join(path);
        let Ok(content) = fs::read_to_string(&full_path) else {
            continue;
        };

        for cap in wiki_link_re.captures_iter(&content) {
            let target = cap[1].trim();
            if let Some(resolved) = resolve_target(target, &vault, &file_map) {
                if resolved != *path {
                    edges.push(GraphEdge {
                        source: path.clone(),
                        target: resolved.clone(),
                    });
                    node_set.insert(resolved);
                }
            }
        }
    }

    let nodes: Vec<GraphNode> = node_set
        .into_iter()
        .map(|path| {
            let label = path
                .rsplit('/')
                .next()
                .unwrap_or(&path)
                .trim_end_matches(".md")
                .to_string();
            GraphNode {
                id: path.clone(),
                label,
                path,
            }
        })
        .collect();

    Ok(LinkGraph { nodes, edges })
}
