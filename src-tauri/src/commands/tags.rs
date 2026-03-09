use crate::config::PrismConfig;
use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct TagInfo {
    pub tag: String,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize)]
pub struct TaggedFile {
    pub path: String,
    pub name: String,
}

fn extract_tags_from_content(content: &str) -> Vec<String> {
    let mut tags = Vec::new();

    // Parse frontmatter tags
    if let Some(fm) = content.strip_prefix("---\n") {
        if let Some(end) = fm.find("\n---") {
            let frontmatter = &fm[..end];
            let mut in_tags = false;
            for line in frontmatter.lines() {
                if line.starts_with("tags:") {
                    let value = line.strip_prefix("tags:").unwrap().trim();
                    // Inline array: tags: [foo, bar]
                    if value.starts_with('[') && value.ends_with(']') {
                        let inner = &value[1..value.len() - 1];
                        for t in inner.split(',') {
                            let t = t.trim().trim_matches('"').trim_matches('\'');
                            if !t.is_empty() {
                                tags.push(t.to_string());
                            }
                        }
                    } else if value.is_empty() {
                        in_tags = true;
                    } else {
                        // Single value
                        let t = value.trim_matches('"').trim_matches('\'');
                        if !t.is_empty() {
                            tags.push(t.to_string());
                        }
                    }
                    continue;
                }
                if in_tags {
                    let trimmed = line.trim();
                    if trimmed.starts_with("- ") {
                        let t = trimmed
                            .strip_prefix("- ")
                            .unwrap()
                            .trim()
                            .trim_matches('"')
                            .trim_matches('\'');
                        if !t.is_empty() {
                            tags.push(t.to_string());
                        }
                    } else {
                        in_tags = false;
                    }
                }
            }
        }
    }

    // Inline #tags from body (skip code blocks and frontmatter)
    let body = if content.starts_with("---\n") {
        content
            .find("\n---\n")
            .map(|i| &content[i + 5..])
            .unwrap_or(content)
    } else {
        content
    };

    let mut in_code_block = false;
    for line in body.lines() {
        if line.starts_with("```") {
            in_code_block = !in_code_block;
            continue;
        }
        if in_code_block {
            continue;
        }
        // Match #tag patterns (word boundary: preceded by space or line start)
        for word in line.split_whitespace() {
            if let Some(tag) = word.strip_prefix('#') {
                let tag = tag.trim_end_matches(|c: char| c.is_ascii_punctuation() && c != '-' && c != '_');
                if !tag.is_empty() && !tag.starts_with('#') && tag.chars().next().is_some_and(|c| c.is_alphabetic()) {
                    tags.push(tag.to_string());
                }
            }
        }
    }

    tags.sort();
    tags.dedup();
    tags
}

fn walk_vault_tags(dir: &Path, vault: &Path, tag_counts: &mut HashMap<String, usize>, tag_files: &mut HashMap<String, Vec<TaggedFile>>) {
    let Ok(read_dir) = fs::read_dir(dir) else { return };
    for entry in read_dir.filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        if path.is_dir() {
            walk_vault_tags(&path, vault, tag_counts, tag_files);
        } else if path.extension().is_some_and(|ext| ext == "md") {
            if let Ok(content) = fs::read_to_string(&path) {
                let tags = extract_tags_from_content(&content);
                let rel = path.strip_prefix(vault).unwrap_or(&path);
                let rel_str = rel.to_string_lossy().to_string();
                let file_name = name.strip_suffix(".md").unwrap_or(&name).to_string();
                for tag in tags {
                    *tag_counts.entry(tag.clone()).or_insert(0) += 1;
                    tag_files.entry(tag).or_default().push(TaggedFile {
                        path: rel_str.clone(),
                        name: file_name.clone(),
                    });
                }
            }
        }
    }
}

#[tauri::command]
pub fn list_tags(config: State<'_, Mutex<PrismConfig>>) -> Result<Vec<TagInfo>, String> {
    let config = config.lock().map_err(|e| e.to_string())?;
    let vault = config.vault_path();
    let mut tag_counts = HashMap::new();
    let mut tag_files = HashMap::new();
    walk_vault_tags(&vault, &vault, &mut tag_counts, &mut tag_files);
    let mut tags: Vec<TagInfo> = tag_counts
        .into_iter()
        .map(|(tag, count)| TagInfo { tag, count })
        .collect();
    tags.sort_by(|a, b| b.count.cmp(&a.count).then(a.tag.cmp(&b.tag)));
    Ok(tags)
}

#[tauri::command]
pub fn files_for_tag(tag: String, config: State<'_, Mutex<PrismConfig>>) -> Result<Vec<TaggedFile>, String> {
    let config = config.lock().map_err(|e| e.to_string())?;
    let vault = config.vault_path();
    let mut tag_counts = HashMap::new();
    let mut tag_files = HashMap::new();
    walk_vault_tags(&vault, &vault, &mut tag_counts, &mut tag_files);
    Ok(tag_files.remove(&tag).unwrap_or_default())
}
