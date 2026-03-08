import { useCallback, useEffect, useRef, useState } from "react";
import { commands } from "@/lib/tauri";
import type { SearchResult } from "@/lib/types";

interface FileFinderProps {
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function FileFinder({ onSelect, onClose }: FileFinderProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
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
    if (!query) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(() => {
      commands.fuzzySearch(query).then(setResults);
    }, 100);
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
      className="fixed inset-0 flex items-start justify-center pt-16 z-50"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-[28rem] border shadow-lg rounded"
        style={{
          background: "var(--prism-bg)",
          borderColor: "var(--prism-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search files..."
          className="w-full px-3 py-2 text-sm outline-none border-b"
          style={{
            background: "var(--prism-bg)",
            color: "var(--prism-fg)",
            borderColor: "var(--prism-border)",
            fontFamily: "var(--font-mono)",
          }}
        />
        <ul ref={listRef} className="max-h-72 overflow-y-auto">
          {results.map((r, i) => (
            <li
              key={r.path}
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
              <div style={{ color: "var(--prism-fg)" }}>{r.name}</div>
              <div
                className="truncate"
                style={{ color: "var(--prism-muted)", fontSize: "11px" }}
              >
                {r.path}
              </div>
              {r.context && (
                <div
                  className="truncate mt-0.5"
                  style={{ color: "var(--prism-muted)", fontSize: "11px" }}
                >
                  {r.context}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
