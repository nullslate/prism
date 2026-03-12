export interface PluginUI {
  sidebar?: React.ComponentType;
  overlay?: {
    id: string;
    label: string;
    component: React.ComponentType;
  };
}

declare global {
  interface Window {
    __PRISM_PLUGINS__?: Record<string, PluginUI>;
  }
}

const loadedPlugins = new Set<string>();

export async function loadPluginBundle(pluginName: string): Promise<PluginUI | null> {
  if (!window.__PRISM_PLUGINS__) {
    window.__PRISM_PLUGINS__ = {};
  }

  if (loadedPlugins.has(pluginName)) {
    return window.__PRISM_PLUGINS__[pluginName] ?? null;
  }

  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = `http://prism-plugin.localhost/${pluginName}/ui/dist/index.js`;
    script.setAttribute("data-plugin", pluginName);
    script.onload = () => {
      loadedPlugins.add(pluginName);
      resolve(window.__PRISM_PLUGINS__?.[pluginName] ?? null);
    };
    script.onerror = () => {
      console.error(`Failed to load UI bundle for plugin: ${pluginName}`);
      loadedPlugins.add(pluginName);
      resolve(null);
    };
    document.head.appendChild(script);
  });
}
