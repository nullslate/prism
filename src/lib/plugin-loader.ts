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
    const isWindows = navigator.userAgent.includes("Windows");
    const base = isWindows
      ? "http://prism-plugin.localhost"
      : "prism-plugin://localhost";
    const url = `${base}/${pluginName}/ui/dist/index.js`;
    const script = document.createElement("script");
    script.src = url;
    script.setAttribute("data-plugin", pluginName);
    script.onload = () => {
      loadedPlugins.add(pluginName);
      resolve(window.__PRISM_PLUGINS__?.[pluginName] ?? null);
    };
    script.onerror = () => {
      loadedPlugins.add(pluginName);
      resolve(null);
    };
    document.head.appendChild(script);
  });
}
