import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { FileNode, PrismConfig, ShortcutConfig, Favorite, Theme, SearchResult, TagInfo, TaggedFile, TemplateMeta, HeadingInfo, LinkGraph, BacklinkResult, VaultSearchMatch, PluginInfo, PluginCommand, PluginStatusItem } from "./types";

export const commands = {
  listFiles: () => invoke<FileNode[]>("list_files"),
  readFile: (path: string) => invoke<string>("read_file", { path }),
  writeFile: (path: string, content: string) => invoke<void>("write_file", { path, content }),
  createFile: (path: string) => invoke<string>("create_file", { path }),
  renameFile: (oldPath: string, newPath: string) => invoke<string>("rename_file", { oldPath, newPath }),
  trashFile: (path: string) => invoke<void>("trash_file", { path }),
  emptyTrash: () => invoke<void>("empty_trash"),
  resolveWikiLink: (target: string) => invoke<string | null>("resolve_wiki_link", { target }),
  appendToInbox: (text: string) => invoke<void>("append_to_inbox", { text }),
  createDailyNote: () => invoke<string>("create_daily_note"),
  listTemplates: () => invoke<TemplateMeta[]>("list_templates"),
  createFromTemplate: (templateName: string, destPath: string) => invoke<string>("create_from_template", { templateName, destPath }),
  getFileHeadings: (path: string) => invoke<HeadingInfo[]>("get_file_headings", { path }),
  toggleTodo: (path: string, line: number) => invoke<string>("toggle_todo", { path, line }),
  listTags: () => invoke<TagInfo[]>("list_tags"),
  filesForTag: (tag: string) => invoke<TaggedFile[]>("files_for_tag", { tag }),
  fuzzySearch: (query: string) => invoke<SearchResult[]>("fuzzy_search", { query }),
  getConfig: () => invoke<PrismConfig>("get_config"),
  reloadConfig: () => invoke<PrismConfig>("reload_config"),
  getShortcuts: () => invoke<ShortcutConfig>("get_shortcuts"),
  setConfig: (config: PrismConfig) => invoke<void>("set_config", { newConfig: config }),
  toggleFavorite: (path: string, label: string) => invoke<Favorite[]>("toggle_favorite", { path, label }),
  openInEditor: (path: string, line: number) => invoke<string>("open_in_editor", { path, line }),
  openConfigInEditor: () => invoke<void>("open_config_in_editor"),
  getTheme: (name: string) => invoke<Theme>("get_theme", { name }),
  listThemes: () => invoke<string[]>("list_themes"),
  copyToClipboard: (text: string) => invoke<void>("copy_to_clipboard", { text }),
  getLinkGraph: () => invoke<LinkGraph>("get_link_graph"),
  getBacklinks: (path: string) => invoke<BacklinkResult[]>("get_backlinks", { path }),
  vaultSearch: (query: string) => invoke<VaultSearchMatch[]>("vault_search", { query }),
  saveImage: (filename: string, base64Data: string) => invoke<string>("save_image", { filename, base64Data }),
  getImage: (path: string) => invoke<string>("get_image", { path }),
  listPlugins: () => invoke<PluginInfo[]>("list_plugins"),
  getPluginCommands: () => invoke<PluginCommand[]>("get_plugin_commands"),
  getPluginStatusItems: () => invoke<PluginStatusItem[]>("get_plugin_status_items"),
  updatePlugins: () => invoke<number>("update_plugins"),
  cleanPlugins: () => invoke<string[]>("clean_plugins"),
  pluginEmit: (event: string, data?: unknown) => invoke<void>("plugin_emit", { event, data }),
  getDebugFlag: () => invoke<boolean>("get_debug_flag"),
  logMessage: (level: string, message: string) => invoke<void>("log_message", { level, message }),
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
