export interface PluginContext {
  currentFile: { path: string; name: string; content: string } | null;
  theme: Record<string, string>;
  on: (event: string, handler: (data: unknown) => void) => () => void;
}

export interface PluginOpts {
  opts: Record<string, unknown>;
}
