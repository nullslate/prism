import { useCallback, useEffect, useRef, useState } from "react";
import { commands } from "@/lib/tauri";
import type { TagInfo, TaggedFile } from "@/lib/types";

interface TagFilterProps {
  onSelect: (path: string) => void;
  onClose: () => void;
}

export function TagFilter({ onSelect, onClose }: TagFilterProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [files, setFiles] = useState<TaggedFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    commands.listTags().then(setTags).catch(console.error);
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, [selectedTag]);

  useEffect(() => {
    const item = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const filtered = query
    ? (selectedTag ? files : tags).filter((item) =>
        ("tag" in item ? item.tag : item.name)
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
    : selectedTag
      ? files
      : tags;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, selectedTag]);

  const selectTag = useCallback(
    async (tag: string) => {
      setSelectedTag(tag);
      setQuery("");
      try {
        const result = await commands.filesForTag(tag);
        setFiles(result);
      } catch (e) {
        console.error("Failed to load files for tag:", e);
      }
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown" || (e.key === "j" && e.ctrlKey)) {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp" || (e.key === "k" && e.ctrlKey)) {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        if (selectedTag) {
          const file = filtered[selectedIndex] as TaggedFile;
          onSelect(file.path);
        } else {
          const tag = filtered[selectedIndex] as TagInfo;
          selectTag(tag.tag);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (selectedTag) {
          setSelectedTag(null);
          setFiles([]);
          setQuery("");
        } else {
          onClose();
        }
      } else if (e.key === "Backspace" && query === "" && selectedTag) {
        setSelectedTag(null);
        setFiles([]);
      }
    },
    [filtered, selectedIndex, selectedTag, query, onSelect, onClose, selectTag],
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
        <div className="flex items-center border-b" style={{ borderColor: "var(--prism-border)" }}>
          {selectedTag && (
            <span
              className="ml-3 px-2 py-0.5 text-xs rounded"
              style={{ background: "var(--prism-selection)", color: "var(--prism-accent)", fontFamily: "var(--font-mono)" }}
            >
              #{selectedTag}
            </span>
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedTag ? "Filter files..." : "Filter tags..."}
            className="flex-1 px-3 py-2 text-sm outline-none"
            style={{
              background: "transparent",
              color: "var(--prism-fg)",
              fontFamily: "var(--font-mono)",
            }}
          />
        </div>
        <ul ref={listRef} className="max-h-72 overflow-y-auto">
          {(filtered as (TagInfo | TaggedFile)[]).map((item, i) => {
            const isTag = "tag" in item;
            return (
              <li
                key={isTag ? item.tag : item.path}
                className="px-3 py-2 text-sm cursor-pointer flex items-center justify-between"
                style={{
                  background: i === selectedIndex ? "var(--prism-selection)" : "transparent",
                  fontFamily: "var(--font-mono)",
                }}
                onClick={() => {
                  if (isTag) {
                    selectTag(item.tag);
                  } else {
                    onSelect(item.path);
                  }
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span style={{ color: "var(--prism-fg)" }}>
                  {isTag ? `#${item.tag}` : item.name}
                </span>
                {isTag && (
                  <span style={{ color: "var(--prism-muted)" }}>{item.count}</span>
                )}
                {!isTag && (
                  <span className="text-xs truncate ml-2" style={{ color: "var(--prism-muted)" }}>
                    {item.path}
                  </span>
                )}
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-3 py-4 text-sm text-center" style={{ color: "var(--prism-muted)" }}>
              {selectedTag ? "No files found" : "No tags found"}
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
