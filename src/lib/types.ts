export interface FileNode {
  name: string;
  path: string;
  is_dir: boolean;
  children: FileNode[];
}

export interface PrismConfig {
  vault: string;
  editor: string;
  terminal: string;
  theme: string;
  inbox: string;
  hotkey: string;
  window: WindowConfig;
  favorites: Favorite[];
}

export interface WindowConfig {
  width: number;
  height: number;
  position: string;
  always_on_top: boolean;
}

export interface Favorite {
  path: string;
  label: string;
}

export interface ShortcutConfig {
  global: Record<string, string>;
  render: Record<string, string>;
}

export interface ThemeColors {
  bg: string;
  fg: string;
  accent: string;
  border: string;
  sidebar_bg: string;
  heading: string;
  code_bg: string;
  selection: string;
  syntax_keyword: string;
  syntax_string: string;
  syntax_comment: string;
  syntax_function: string;
  syntax_number: string;
  syntax_operator: string;
  syntax_type: string;
  syntax_variable: string;
}

export interface Theme {
  colors: ThemeColors;
}

export interface SearchResult {
  path: string;
  name: string;
  score: number;
  context: string | null;
}

export interface TagInfo {
  tag: string;
  count: number;
}

export interface TaggedFile {
  path: string;
  name: string;
}

export interface VaultSearchMatch {
  path: string;
  name: string;
  line_number: number;
  context: string;
}

export interface BacklinkResult {
  path: string;
  name: string;
  context: string;
}

export interface GraphNode {
  id: string;
  label: string;
  path: string;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface LinkGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface PluginInfo {
  name: string;
  version: string;
  description: string;
  path: string;
  enabled: boolean;
  loaded: boolean;
  error: string | null;
  commands: PluginCommandStub[];
  status_items: PluginStatusItem[];
}

export interface PluginCommandStub {
  id: string;
  label: string;
}

export interface PluginCommand {
  id: string;
  label: string;
  plugin: string;
  shortcut: string | null;
}

export interface PluginStatusItem {
  id: string;
  plugin: string;
  align: string;
  text: string;
}
