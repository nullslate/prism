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
