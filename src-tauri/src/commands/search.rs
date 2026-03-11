use crate::config::PrismConfig;
use nucleo_matcher::{
    pattern::{CaseMatching, Normalization, Pattern},
    Config, Matcher,
};
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct SearchResult {
    pub path: String,
    pub name: String,
    pub score: u32,
    pub context: Option<String>,
}

fn collect_md_files(dir: &Path, vault_root: &Path, out: &mut Vec<(String, String)>) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if path
            .file_name()
            .is_some_and(|n| n.to_string_lossy().starts_with('.'))
        {
            continue;
        }
        if path.is_dir() {
            collect_md_files(&path, vault_root, out);
        } else if path.extension().is_some_and(|ext| ext == "md") {
            let rel = path
                .strip_prefix(vault_root)
                .unwrap_or(&path)
                .to_string_lossy()
                .to_string();
            let content = fs::read_to_string(&path).unwrap_or_default();
            out.push((rel, content));
        }
    }
}

#[tauri::command]
pub fn fuzzy_search(
    query: String,
    config: State<'_, Mutex<PrismConfig>>,
) -> Result<Vec<SearchResult>, String> {
    if query.is_empty() {
        return Ok(vec![]);
    }

    let config = config.lock().map_err(|e| e.to_string())?;
    let vault = config.vault_path();

    let mut files: Vec<(String, String)> = Vec::new();
    collect_md_files(&vault, &vault, &mut files);

    let mut matcher = Matcher::new(Config::DEFAULT.match_paths());
    let pattern = Pattern::parse(&query, CaseMatching::Ignore, Normalization::Smart);

    let mut results: Vec<SearchResult> = Vec::new();

    for (path, content) in &files {
        let name = Path::new(path)
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let name_score: Vec<(&str, u32)> =
            pattern.match_list(std::iter::once(name.as_str()), &mut matcher);
        let path_score: Vec<(&str, u32)> =
            pattern.match_list(std::iter::once(path.as_str()), &mut matcher);

        let best_name_score = name_score
            .first()
            .map(|m| m.1)
            .unwrap_or(0)
            .max(path_score.first().map(|m| m.1).unwrap_or(0));

        let mut best_content_score = 0u32;
        let mut best_line: Option<String> = None;
        for line in content.lines().take(500) {
            let line_matches: Vec<(&str, u32)> =
                pattern.match_list(std::iter::once(line), &mut matcher);
            if let Some(m) = line_matches.first() {
                if m.1 > best_content_score {
                    best_content_score = m.1;
                    best_line = Some(line.chars().take(100).collect());
                }
            }
        }

        let total_score = best_name_score.max(best_content_score);
        if total_score > 0 {
            results.push(SearchResult {
                path: path.clone(),
                name,
                score: total_score,
                context: best_line,
            });
        }
    }

    results.sort_by(|a, b| b.score.cmp(&a.score));
    results.truncate(20);
    Ok(results)
}

#[derive(Debug, Clone, Serialize)]
pub struct VaultSearchMatch {
    pub path: String,
    pub name: String,
    pub line_number: usize,
    pub context: String,
}

#[tauri::command]
pub fn vault_search(
    query: String,
    config: State<'_, Mutex<PrismConfig>>,
) -> Result<Vec<VaultSearchMatch>, String> {
    if query.is_empty() {
        return Ok(vec![]);
    }

    let config = config.lock().map_err(|e| e.to_string())?;
    let vault = config.vault_path();

    let mut files: Vec<(String, String)> = Vec::new();
    collect_md_files(&vault, &vault, &mut files);

    let query_lower = query.to_lowercase();
    let mut results: Vec<VaultSearchMatch> = Vec::new();

    for (path, content) in &files {
        let name = Path::new(path)
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        for (i, line) in content.lines().enumerate() {
            if line.to_lowercase().contains(&query_lower) {
                results.push(VaultSearchMatch {
                    path: path.clone(),
                    name: name.clone(),
                    line_number: i + 1,
                    context: line.chars().take(120).collect(),
                });
                if results.len() >= 100 {
                    return Ok(results);
                }
            }
        }
    }

    Ok(results)
}
