import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { commands, onConfigChanged } from "@/lib/tauri";
import { useTheme } from "@/hooks/use-theme";
import type { Favorite, PrismConfig, ShortcutConfig } from "@/lib/types";

interface PrismContextValue {
  config: PrismConfig | null;
  shortcuts: ShortcutConfig | null;
  favorites: Favorite[];
  toggleFavorite: (path: string, label: string) => void;
}

const PrismContext = createContext<PrismContextValue>({
  config: null,
  shortcuts: null,
  favorites: [],
  toggleFavorite: () => {},
});

export function usePrism() {
  return useContext(PrismContext);
}

export function PrismProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<PrismConfig | null>(null);
  const [shortcuts, setShortcuts] = useState<ShortcutConfig | null>(null);
  const [favorites, setFavorites] = useState<Favorite[]>([]);

  const loadConfig = useCallback(() => {
    commands
      .getConfig()
      .then((cfg) => {
        setConfig(cfg);
        setFavorites(cfg.favorites);
      })
      .catch(console.error);
    commands.getShortcuts().then(setShortcuts).catch(console.error);
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const unlisten = onConfigChanged(() => {
      commands.reloadConfig().then((cfg) => {
        setConfig(cfg);
        setFavorites(cfg.favorites);
      }).catch(console.error);
      commands.getShortcuts().then(setShortcuts).catch(console.error);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  useTheme(config?.theme ?? "catppuccin-mocha");

  const toggleFavorite = useCallback((path: string, label: string) => {
    commands.toggleFavorite(path, label).then(setFavorites).catch(console.error);
  }, []);

  return (
    <PrismContext.Provider value={{ config, shortcuts, favorites, toggleFavorite }}>
      {children}
    </PrismContext.Provider>
  );
}
