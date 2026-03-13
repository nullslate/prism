import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { commands, onConfigChanged } from "@/lib/tauri";
import { useTheme } from "@/hooks/use-theme";
import { log, setDebugEnabled, printBanner } from "@/lib/logger";
import type { Favorite, PrismConfig, ShortcutConfig, PluginCommand, PluginStatusItem } from "@/lib/types";

interface PrismContextValue {
  config: PrismConfig | null;
  shortcuts: ShortcutConfig | null;
  favorites: Favorite[];
  pluginCommands: PluginCommand[];
  pluginStatusItems: PluginStatusItem[];
  toggleFavorite: (path: string, label: string) => void;
}

const PrismContext = createContext<PrismContextValue>({
  config: null,
  shortcuts: null,
  favorites: [],
  pluginCommands: [],
  pluginStatusItems: [],
  toggleFavorite: () => {},
});

export function usePrism() {
  return useContext(PrismContext);
}

export function PrismProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<PrismConfig | null>(null);
  const [shortcuts, setShortcuts] = useState<ShortcutConfig | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [pluginCommands, setPluginCommands] = useState<PluginCommand[]>([]);
  const [pluginStatusItems, setPluginStatusItems] = useState<PluginStatusItem[]>([]);

  const bannerPrinted = useRef(false);

  const loadConfig = useCallback(() => {
    commands
      .getConfig()
      .then((cfg) => {
        setConfig(cfg);
        setFavorites(cfg.favorites);
        if (!bannerPrinted.current) {
          bannerPrinted.current = true;
          commands.getDebugFlag().then((debug) => {
            setDebugEnabled(debug);
            printBanner({ theme: cfg.theme, vault: cfg.vault, debug });
            log.info("config loaded");
            log.info("theme:", cfg.theme);
            log.info("vault:", cfg.vault);
            log.info("favorites:", cfg.favorites.length);
          }).catch(() => {
            printBanner({ theme: cfg.theme, vault: cfg.vault, debug: false });
            log.info("config loaded");
          });
        }
      })
      .catch((e) => log.error("Failed to load config:", e));
    commands.getShortcuts().then(setShortcuts).catch((e) => log.error("Failed to load shortcuts:", e));
    commands.getPluginCommands().then(setPluginCommands).catch((e) => log.error("Failed to load plugin commands:", e));
    commands.getPluginStatusItems().then(setPluginStatusItems).catch((e) => log.error("Failed to load plugin status:", e));
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const unlisten = onConfigChanged(() => {
      commands.reloadConfig().then((cfg) => {
        setConfig(cfg);
        setFavorites(cfg.favorites);
      }).catch((e) => log.error("Failed to reload config:", e));
      commands.getShortcuts().then(setShortcuts).catch((e) => log.error("Failed to reload shortcuts:", e));
      commands.getPluginCommands().then(setPluginCommands).catch((e) => log.error("Failed to reload plugin commands:", e));
      commands.getPluginStatusItems().then(setPluginStatusItems).catch((e) => log.error("Failed to reload plugin status:", e));
      commands.getDebugFlag().then(setDebugEnabled).catch(() => {});
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  useTheme(config?.theme ?? "catppuccin-mocha");

  const toggleFavorite = useCallback((path: string, label: string) => {
    commands.toggleFavorite(path, label).then(setFavorites).catch((e) => log.error("Failed to toggle favorite:", e));
  }, []);

  return (
    <PrismContext.Provider value={{ config, shortcuts, favorites, pluginCommands, pluginStatusItems, toggleFavorite }}>
      {children}
    </PrismContext.Provider>
  );
}
