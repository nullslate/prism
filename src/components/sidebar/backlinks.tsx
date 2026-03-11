import { useEffect, useState } from "react";
import { commands } from "@/lib/tauri";
import type { BacklinkResult } from "@/lib/types";

interface BacklinksProps {
  currentPath: string | null;
  onSelect: (path: string) => void;
}

export function Backlinks({ currentPath, onSelect }: BacklinksProps) {
  const [backlinks, setBacklinks] = useState<BacklinkResult[]>([]);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!currentPath) {
      setBacklinks([]);
      return;
    }
    commands.getBacklinks(currentPath).then(setBacklinks).catch(() => setBacklinks([]));
  }, [currentPath]);

  if (!currentPath || backlinks.length === 0) return null;

  return (
    <div className="border-t" style={{ borderColor: "var(--prism-border)" }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-3 py-1.5 text-xs font-bold uppercase tracking-widest flex items-center gap-1.5"
        style={{ color: "var(--prism-muted)" }}
      >
        <span className="w-3 text-center">{expanded ? "\u25BE" : "\u25B8"}</span>
        Backlinks
        <span
          className="ml-auto text-[10px] font-normal"
          style={{ color: "var(--prism-muted)" }}
        >
          {backlinks.length}
        </span>
      </button>
      {expanded && (
        <ul className="list-none m-0 p-0 pb-2">
          {backlinks.map((bl) => (
            <li key={bl.path}>
              <button
                onClick={() => onSelect(bl.path)}
                className="w-full text-left px-3 py-1 text-sm hover:opacity-80"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <div style={{ color: "var(--prism-accent)" }}>{bl.name}</div>
                <div
                  className="truncate"
                  style={{ color: "var(--prism-muted)", fontSize: "11px" }}
                >
                  {bl.context}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
