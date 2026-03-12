import { useCallback, useEffect, useRef, useState } from "react";
import { commands } from "@/lib/tauri";
import { usePrism } from "@/components/prism-provider";

interface ThemePickerProps {
  onClose: () => void;
}

export function ThemePicker({ onClose }: ThemePickerProps) {
  const { config } = usePrism();
  const [themes, setThemes] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const originalTheme = useRef(config?.theme ?? "catppuccin-mocha");
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    commands.listThemes().then((t) => {
      setThemes(t);
      const idx = t.indexOf(originalTheme.current);
      if (idx >= 0) setCursor(idx);
    });
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = query
    ? themes.filter((t) => t.toLowerCase().includes(query.toLowerCase()))
    : themes;

  useEffect(() => {
    setCursor(0);
  }, [query]);

  useEffect(() => {
    const item = listRef.current?.children[cursor] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  // Live preview on cursor change
  useEffect(() => {
    const name = filtered[cursor];
    if (!name) return;
    commands.getTheme(name).then((theme) => {
      const root = document.documentElement;
      const c = theme.colors;
      root.style.setProperty("--prism-bg", c.bg);
      root.style.setProperty("--prism-fg", c.fg);
      root.style.setProperty("--prism-accent", c.accent);
      root.style.setProperty("--prism-border", c.border);
      root.style.setProperty("--prism-sidebar-bg", c.sidebar_bg);
      root.style.setProperty("--prism-heading", c.heading);
      root.style.setProperty("--prism-code-bg", c.code_bg);
      root.style.setProperty("--prism-selection", c.selection);
      root.style.setProperty("--prism-syntax-keyword", c.syntax_keyword);
      root.style.setProperty("--prism-syntax-string", c.syntax_string);
      root.style.setProperty("--prism-syntax-comment", c.syntax_comment);
      root.style.setProperty("--prism-syntax-function", c.syntax_function);
      root.style.setProperty("--prism-syntax-number", c.syntax_number);
      root.style.setProperty("--prism-syntax-operator", c.syntax_operator);
      root.style.setProperty("--prism-syntax-type", c.syntax_type);
      root.style.setProperty("--prism-syntax-variable", c.syntax_variable);
    });
  }, [cursor, filtered]);

  const revert = useCallback(() => {
    commands.getTheme(originalTheme.current).then((theme) => {
      const root = document.documentElement;
      const c = theme.colors;
      root.style.setProperty("--prism-bg", c.bg);
      root.style.setProperty("--prism-fg", c.fg);
      root.style.setProperty("--prism-accent", c.accent);
      root.style.setProperty("--prism-border", c.border);
      root.style.setProperty("--prism-sidebar-bg", c.sidebar_bg);
      root.style.setProperty("--prism-heading", c.heading);
      root.style.setProperty("--prism-code-bg", c.code_bg);
      root.style.setProperty("--prism-selection", c.selection);
      root.style.setProperty("--prism-syntax-keyword", c.syntax_keyword);
      root.style.setProperty("--prism-syntax-string", c.syntax_string);
      root.style.setProperty("--prism-syntax-comment", c.syntax_comment);
      root.style.setProperty("--prism-syntax-function", c.syntax_function);
      root.style.setProperty("--prism-syntax-number", c.syntax_number);
      root.style.setProperty("--prism-syntax-operator", c.syntax_operator);
      root.style.setProperty("--prism-syntax-type", c.syntax_type);
      root.style.setProperty("--prism-syntax-variable", c.syntax_variable);
    });
  }, []);

  const save = useCallback(async () => {
    const name = filtered[cursor];
    if (!name || !config) return;
    await commands.setConfig({ ...config, theme: name });
    onClose();
  }, [filtered, cursor, config, onClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown" || (e.key === "j" && e.ctrlKey)) {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp" || (e.key === "k" && e.ctrlKey)) {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        save();
      } else if (e.key === "Escape") {
        e.preventDefault();
        revert();
        onClose();
      }
    },
    [filtered, save, revert, onClose],
  );

  return (
    <div
      className="fixed inset-0 flex items-start justify-center pt-16 z-50"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={() => { revert(); onClose(); }}
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
          placeholder="Select theme..."
          className="w-full px-3 py-2 text-sm outline-none border-b"
          style={{
            background: "var(--prism-bg)",
            color: "var(--prism-fg)",
            borderColor: "var(--prism-border)",
            fontFamily: "var(--font-mono)",
          }}
        />
        <ul ref={listRef} className="max-h-72 overflow-y-auto">
          {filtered.map((name, i) => (
            <li
              key={name}
              className="px-3 py-2 text-sm cursor-pointer flex items-center justify-between"
              style={{
                background: i === cursor ? "var(--prism-selection)" : "transparent",
                fontFamily: "var(--font-mono)",
              }}
              onClick={() => {
                setCursor(i);
                save();
              }}
              onMouseEnter={() => setCursor(i)}
            >
              <span style={{ color: "var(--prism-fg)" }}>{name}</span>
              {name === originalTheme.current && (
                <span style={{ color: "var(--prism-muted)" }}>current</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
