import { memo } from "react";
import type { Favorite } from "@/lib/types";

interface FavoritesProps {
  favorites: Favorite[];
  currentPath: string | null;
  onSelect: (path: string) => void;
}

export const Favorites = memo(function Favorites({ favorites, currentPath, onSelect }: FavoritesProps) {
  if (favorites.length === 0) return null;

  return (
    <div className="mb-2">
      <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest" style={{ color: "var(--prism-muted)" }}>
        Favorites
      </div>
      <ul className="list-none m-0 p-0">
        {favorites.map((fav, i) => (
          <li key={fav.path}>
            <button
              onClick={() => onSelect(fav.path)}
              className="w-full text-left flex items-center gap-2 py-1 px-3 text-sm"
              style={{
                fontFamily: "var(--font-mono)",
                color: currentPath === fav.path ? "var(--prism-accent)" : "var(--prism-fg)",
                background: currentPath === fav.path ? "var(--prism-selection)" : "transparent",
              }}
            >
              <span style={{ color: "var(--prism-muted)" }}>{i + 1}</span>
              {fav.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
});
