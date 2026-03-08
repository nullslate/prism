import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { FileNode, PrismConfig, Favorite, Theme, SearchResult } from "./types";

export const commands = {
  listFiles: () => invoke<FileNode[]>("list_files"),
  readFile: (path: string) => invoke<string>("read_file", { path }),
  fuzzySearch: (query: string) => invoke<SearchResult[]>("fuzzy_search", { query }),
  getConfig: () => invoke<PrismConfig>("get_config"),
  reloadConfig: () => invoke<PrismConfig>("reload_config"),
  setConfig: (config: PrismConfig) => invoke<void>("set_config", { newConfig: config }),
  toggleFavorite: (path: string, label: string) => invoke<Favorite[]>("toggle_favorite", { path, label }),
  openInEditor: (path: string, line: number) => invoke<string>("open_in_editor", { path, line }),
  getTheme: (name: string) => invoke<Theme>("get_theme", { name }),
};

export function onFileChanged(callback: (path: string) => void): Promise<UnlistenFn> {
  return listen<{ path: string }>("file-changed", (event) => {
    callback(event.payload.path);
  });
}

export function onConfigChanged(callback: () => void): Promise<UnlistenFn> {
  return listen("config-changed", () => {
    callback();
  });
}
