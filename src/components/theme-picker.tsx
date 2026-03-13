import { useCallback, useEffect, useRef, useState } from "react";
import { commands } from "@/lib/tauri";
import { usePrism } from "@/components/prism-provider";
import type { ThemeColors } from "@/lib/types";

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
  const [previewColors, setPreviewColors] = useState<ThemeColors | null>(null);

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
      setPreviewColors(c);
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

  const paletteSwatches = previewColors
    ? [
        { color: previewColors.bg, label: "bg" },
        { color: previewColors.fg, label: "fg" },
        { color: previewColors.accent, label: "accent" },
        { color: previewColors.sidebar_bg, label: "sidebar" },
        { color: previewColors.selection, label: "sel" },
        { color: previewColors.code_bg, label: "code" },
        { color: previewColors.syntax_keyword, label: "kw" },
        { color: previewColors.syntax_string, label: "str" },
        { color: previewColors.syntax_function, label: "fn" },
        { color: previewColors.syntax_comment, label: "cmt" },
        { color: previewColors.syntax_type, label: "type" },
        { color: previewColors.syntax_variable, label: "var" },
      ]
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--prism-bg)" }}
    >
      <div
        className="flex items-center border-b px-3 gap-2"
        style={{ borderColor: "var(--prism-border)" }}
      >
        <span style={{ color: "var(--prism-muted)" }}>&#x25cf;</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Select theme..."
          className="flex-1 py-2.5 text-sm outline-none"
          style={{
            background: "transparent",
            color: "var(--prism-fg)",
            fontFamily: "var(--font-mono)",
          }}
        />
        <button
          onClick={() => { revert(); onClose(); }}
          className="w-7 h-7 flex items-center justify-center text-sm hover:opacity-80"
          style={{ color: "var(--prism-muted)" }}
        >
          &#x00D7;
        </button>
      </div>
      {paletteSwatches.length > 0 && (
        <div
          className="flex items-center gap-1 px-3 py-2 border-b"
          style={{ borderColor: "var(--prism-border)" }}
        >
          {paletteSwatches.map((s) => (
            <div
              key={s.label}
              title={s.label}
              className="flex-1 h-4 rounded-sm"
              style={{
                background: s.color,
                border: "1px solid var(--prism-border)",
              }}
            />
          ))}
        </div>
      )}
      <ul ref={listRef} className="flex-1 overflow-y-auto">
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
  );
}
