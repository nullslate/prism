use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use tauri::State;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrecencyEntry {
    pub count: u32,
    pub last_opened: i64,
    pub score: f64,
}

pub struct FrecencyStore {
    entries: RwLock<HashMap<String, FrecencyEntry>>,
    file_path: RwLock<PathBuf>,
    dirty: RwLock<bool>,
}

impl FrecencyStore {
    pub fn new() -> Self {
        Self {
            entries: RwLock::new(HashMap::new()),
            file_path: RwLock::new(PathBuf::new()),
            dirty: RwLock::new(false),
        }
    }

    pub fn init(&self, vault_path: &str) {
        let mut hasher = std::collections::hash_map::DefaultHasher::new();
        vault_path.hash(&mut hasher);
        let hash = hasher.finish();

        let config_dir = dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("prism");
        let _ = std::fs::create_dir_all(&config_dir);

        let path = config_dir.join(format!("frecency-{:x}.json", hash));

        if path.exists() {
            if let Ok(data) = std::fs::read_to_string(&path) {
                if let Ok(entries) = serde_json::from_str::<HashMap<String, FrecencyEntry>>(&data)
                {
                    *self.entries.write().unwrap() = entries;
                }
            }
        }

        *self.file_path.write().unwrap() = path;
    }

    pub fn record_open(&self, path: &str) {
        let now = chrono::Utc::now().timestamp();
        let mut entries = self.entries.write().unwrap();
        let entry = entries.entry(path.to_string()).or_insert(FrecencyEntry {
            count: 0,
            last_opened: 0,
            score: 0.0,
        });
        entry.count += 1;
        entry.last_opened = now;
        entry.score = self.compute_score(entry.count, entry.last_opened, now);
        *self.dirty.write().unwrap() = true;
    }

    pub fn flush(&self) {
        let dirty = *self.dirty.read().unwrap();
        if !dirty {
            return;
        }
        let file_path = self.file_path.read().unwrap().clone();
        if file_path.as_os_str().is_empty() {
            return;
        }
        let entries = self.entries.read().unwrap();
        if let Ok(json) = serde_json::to_string_pretty(&*entries) {
            let _ = std::fs::write(&file_path, json);
        }
        *self.dirty.write().unwrap() = false;
    }

    pub fn get_scores(&self) -> HashMap<String, f64> {
        let now = chrono::Utc::now().timestamp();
        let entries = self.entries.read().unwrap();
        entries
            .iter()
            .map(|(path, entry)| {
                (
                    path.clone(),
                    self.compute_score(entry.count, entry.last_opened, now),
                )
            })
            .collect()
    }

    pub fn get_recent(&self, limit: usize) -> Vec<String> {
        let entries = self.entries.read().unwrap();
        let mut sorted: Vec<_> = entries.iter().collect();
        sorted.sort_by(|a, b| b.1.last_opened.cmp(&a.1.last_opened));
        sorted.into_iter().take(limit).map(|(k, _)| k.clone()).collect()
    }

    fn compute_score(&self, count: u32, last_opened: i64, now: i64) -> f64 {
        let days_ago = ((now - last_opened) as f64) / 86400.0;
        // Halve score every 7 days
        let decay = 0.5_f64.powf(days_ago / 7.0);
        (count as f64) * decay
    }
}

#[tauri::command]
pub fn record_file_open(path: String, frecency: State<'_, Arc<FrecencyStore>>) {
    frecency.record_open(&path);
    frecency.flush();
}

#[tauri::command]
pub fn get_frecency_scores(
    frecency: State<'_, Arc<FrecencyStore>>,
) -> HashMap<String, f64> {
    frecency.get_scores()
}

#[tauri::command]
pub fn get_recent_files(
    limit: usize,
    frecency: State<'_, Arc<FrecencyStore>>,
) -> Vec<String> {
    frecency.get_recent(limit)
}
