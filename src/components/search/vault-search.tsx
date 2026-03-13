import { useCallback, useEffect, useRef, useState } from "react";
import { commands } from "@/lib/tauri";
import type { VaultSearchMatch } from "@/lib/types";

interface VaultSearchProps {
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function VaultSearch({ onSelect, onClose }: VaultSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VaultSearchMatch[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  useEffect(() => {
    if (!query || query.length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      commands.vaultSearch(query).then(setResults);
    }, 150);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown" || (e.key === "j" && e.ctrlKey)) {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp" || (e.key === "k" && e.ctrlKey)) {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        e.preventDefault();
        onSelect(results[selectedIndex].path);
        onClose();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [results, selectedIndex, onSelect, onClose],
  );

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--prism-bg)" }}
    >
      <div
        className="flex items-center border-b px-3 gap-2"
        style={{ borderColor: "var(--prism-border)" }}
      >
        <span style={{ color: "var(--prism-muted)" }}>&#x2315;</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search vault contents..."
          className="flex-1 py-2.5 text-sm outline-none"
          style={{
            background: "transparent",
            color: "var(--prism-fg)",
            fontFamily: "var(--font-mono)",
          }}
        />
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center text-sm hover:opacity-80"
          style={{ color: "var(--prism-muted)" }}
        >
          &#x00D7;
        </button>
      </div>
      {results.length > 0 && (
        <div
          className="px-3 py-1 text-[10px] border-b"
          style={{
            color: "var(--prism-muted)",
            borderColor: "var(--prism-border)",
          }}
        >
          {results.length} match{results.length !== 1 ? "es" : ""}
        </div>
      )}
      <ul ref={listRef} className="flex-1 overflow-y-auto">
        {results.map((r, i) => (
          <li
            key={`${r.path}:${r.line_number}`}
            className="px-3 py-2 text-sm cursor-pointer"
            style={{
              background:
                i === selectedIndex
                  ? "var(--prism-selection)"
                  : "transparent",
              fontFamily: "var(--font-mono)",
            }}
            onClick={() => {
              onSelect(r.path);
              onClose();
            }}
            onMouseEnter={() => setSelectedIndex(i)}
          >
            <div className="flex items-center gap-2">
              <span style={{ color: "var(--prism-fg)" }}>{r.name}</span>
              <span
                style={{ color: "var(--prism-muted)", fontSize: "10px" }}
              >
                :{r.line_number}
              </span>
            </div>
            <div
              className="truncate"
              style={{ color: "var(--prism-muted)", fontSize: "11px" }}
            >
              {r.path}
            </div>
            <div
              className="truncate mt-0.5"
              style={{ color: "var(--prism-muted)", fontSize: "11px" }}
            >
              {r.context}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
