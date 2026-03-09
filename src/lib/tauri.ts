import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { FileNode, PrismConfig, Favorite, Theme, SearchResult, TagInfo, TaggedFile } from "./types";

export const commands = {
  listFiles: () => invoke<FileNode[]>("list_files"),
  readFile: (path: string) => invoke<string>("read_file", { path }),
  writeFile: (path: string, content: string) => invoke<void>("write_file", { path, content }),
  createFile: (path: string) => invoke<string>("create_file", { path }),
  trashFile: (path: string) => invoke<void>("trash_file", { path }),
  emptyTrash: () => invoke<void>("empty_trash"),
  resolveWikiLink: (target: string) => invoke<string | null>("resolve_wiki_link", { target }),
  appendToInbox: (text: string) => invoke<void>("append_to_inbox", { text }),
  listTags: () => invoke<TagInfo[]>("list_tags"),
  filesForTag: (tag: string) => invoke<TaggedFile[]>("files_for_tag", { tag }),
  fuzzySearch: (query: string) => invoke<SearchResult[]>("fuzzy_search", { query }),
  getConfig: () => invoke<PrismConfig>("get_config"),
  reloadConfig: () => invoke<PrismConfig>("reload_config"),
  setConfig: (config: PrismConfig) => invoke<void>("set_config", { newConfig: config }),
  toggleFavorite: (path: string, label: string) => invoke<Favorite[]>("toggle_favorite", { path, label }),
  openInEditor: (path: string, line: number) => invoke<string>("open_in_editor", { path, line }),
  openConfigInEditor: () => invoke<void>("open_config_in_editor"),
  getTheme: (name: string) => invoke<Theme>("get_theme", { name }),
  copyToClipboard: (text: string) => invoke<void>("copy_to_clipboard", { text }),
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
