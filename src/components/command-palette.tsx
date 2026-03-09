import { useCallback, useEffect, useRef, useState } from "react";

interface Command {
  id: string;
  label: string;
  shortcut?: string;
  action: () => void;
}

interface CommandPaletteProps {
  commands: Command[];
  onClose: () => void;
}

export function CommandPalette({ commands: cmds, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const item = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const filtered = query
    ? cmds.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : cmds;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

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
        filtered[selectedIndex].action();
        onClose();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, selectedIndex, onClose],
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
          placeholder="Type a command..."
          className="w-full px-3 py-2 text-sm outline-none border-b"
          style={{
            background: "var(--prism-bg)",
            color: "var(--prism-fg)",
            borderColor: "var(--prism-border)",
            fontFamily: "var(--font-mono)",
          }}
        />
        <ul ref={listRef} className="max-h-72 overflow-y-auto">
          {filtered.map((cmd, i) => (
            <li
              key={cmd.id}
              className="px-3 py-2 text-sm cursor-pointer flex items-center justify-between"
              style={{
                background:
                  i === selectedIndex
                    ? "var(--prism-selection)"
                    : "transparent",
                fontFamily: "var(--font-mono)",
              }}
              onClick={() => {
                cmd.action();
                onClose();
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span style={{ color: "var(--prism-fg)" }}>{cmd.label}</span>
              {cmd.shortcut && (
                <span style={{ color: "var(--prism-muted)" }}>
                  {cmd.shortcut}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
