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
  const [recentFiles, setRecentFiles] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    commands.getRecentFiles(10).then((paths) => {
      setRecentFiles(
        paths.map((p) => ({
          path: p,
          name: p.replace(/\.md$/, "").split("/").pop() || p,
          score: 0,
          context: null,
        })),
      );
    }).catch(() => {});
  }, []);

  const displayResults = query ? results : recentFiles;

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
    }, 30);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results, recentFiles]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown" || (e.key === "j" && e.ctrlKey)) {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, displayResults.length - 1));
      } else if (e.key === "ArrowUp" || (e.key === "k" && e.ctrlKey)) {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && displayResults[selectedIndex]) {
        e.preventDefault();
        onSelect(displayResults[selectedIndex].path);
        onClose();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [displayResults, selectedIndex, onSelect, onClose],
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
          placeholder="Search files..."
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
      <ul ref={listRef} className="flex-1 overflow-y-auto">
        {!query && displayResults.length > 0 && (
          <li
            className="px-3 py-1.5 text-xs uppercase tracking-wide"
            style={{ color: "var(--prism-muted)" }}
          >
            Recent
          </li>
        )}
        {displayResults.map((r, i) => (
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
  );
}
