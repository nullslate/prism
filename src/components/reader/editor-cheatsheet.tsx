import { memo, useEffect, useMemo, useState } from "react";

interface Binding {
  keys: string;
  desc: string;
  group: string;
}

const BINDINGS: Binding[] = [
  // Modes
  { keys: "i / a / o", desc: "Insert before / after / new line below", group: "Modes" },
  { keys: "I / A / O", desc: "Insert at line start / end / new line above", group: "Modes" },
  { keys: "v / V", desc: "Visual / Visual line", group: "Modes" },
  { keys: "<Esc>", desc: "Back to normal mode", group: "Modes" },
  { keys: "<C-c>", desc: "Back to normal mode", group: "Modes" },

  // Save / quit
  { keys: ":w  :wq  :x  <Space>w  <Space>x  <C-s>", desc: "Save & return to reader", group: "File" },
  { keys: "<Space>s", desc: "Save without leaving editor", group: "File" },
  { keys: ":q  /  <Space>q  /  <Space>e", desc: "Close editor (discard unsaved)", group: "File" },

  // Navigation (vault)
  { keys: "<Space>ff", desc: "Find file", group: "Navigate" },
  { keys: "<Space>fg", desc: "Grep vault", group: "Navigate" },
  { keys: "<Space>fb", desc: "Buffers (recent files)", group: "Navigate" },
  { keys: "<Space>fp", desc: "Command palette", group: "Navigate" },

  // Wiki / links
  { keys: "gf  /  gd", desc: "Follow wiki link under cursor", group: "Links" },
  { keys: "[[ name ]]", desc: "Autocomplete shows vault files", group: "Links" },

  // Motions
  { keys: "h j k l", desc: "Left / down / up / right", group: "Motion" },
  { keys: "w / b / e", desc: "Word forward / back / end", group: "Motion" },
  { keys: "0 / ^ / $", desc: "Line start / first non-blank / end", group: "Motion" },
  { keys: "gg / G", desc: "Top / bottom", group: "Motion" },
  { keys: "{ / }", desc: "Prev / next paragraph", group: "Motion" },
  { keys: "]] / [[", desc: "Next / prev heading", group: "Motion" },
  { keys: "<C-u> / <C-d>", desc: "Half page up / down", group: "Motion" },
  { keys: "<C-o> / <C-i>", desc: "Jump back / forward across files", group: "Motion" },

  // Editing
  { keys: "d / c / y", desc: "Delete / change / yank (with motion)", group: "Edit" },
  { keys: "dd / yy / cc", desc: "Delete / yank / change line", group: "Edit" },
  { keys: "p / P", desc: "Paste after / before", group: "Edit" },
  { keys: "u / <C-r>", desc: "Undo / redo", group: "Edit" },
  { keys: ".", desc: "Repeat last change", group: "Edit" },
  { keys: "<<  /  >>", desc: "Indent left / right", group: "Edit" },
  { keys: "<Enter> in list", desc: "Continue list / todo automatically", group: "Edit" },

  // Yank to system clipboard
  { keys: "<Space>y  (visual)", desc: "Yank selection to system clipboard", group: "Clipboard" },
  { keys: "<Space>yy", desc: "Yank current line to system clipboard", group: "Clipboard" },

  // Todos
  { keys: "<Space>tt", desc: "Toggle todo on current line", group: "Todo" },
  { keys: "<Space>tn", desc: "New todo below + insert mode", group: "Todo" },
  { keys: "<Space>ta", desc: "Wrap line into a todo", group: "Todo" },

  // Search
  { keys: "/ pattern", desc: "Search in file (vim)", group: "Search" },
  { keys: "n / N", desc: "Next / prev match", group: "Search" },
  { keys: "* / #", desc: "Search word under cursor fwd / back", group: "Search" },

  // Help
  { keys: "?  /  <Space>?", desc: "Toggle this cheatsheet", group: "Help" },
];

interface EditorCheatsheetProps {
  visible: boolean;
  onClose: () => void;
}

export const EditorCheatsheet = memo(function EditorCheatsheet({ visible, onClose }: EditorCheatsheetProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!visible) {
      setQuery("");
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || (e.key === "?" && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [visible, onClose]);

  const filtered = useMemo(() => {
    if (!query.trim()) return BINDINGS;
    const q = query.toLowerCase();
    return BINDINGS.filter(
      (b) => b.keys.toLowerCase().includes(q) || b.desc.toLowerCase().includes(q) || b.group.toLowerCase().includes(q),
    );
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Binding[]>();
    for (const b of filtered) {
      if (!map.has(b.group)) map.set(b.group, []);
      map.get(b.group)!.push(b);
    }
    return Array.from(map.entries());
  }, [filtered]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12"
      style={{ background: "color-mix(in srgb, var(--prism-bg) 80%, transparent)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[min(720px,92vw)] max-h-[80vh] flex flex-col rounded-lg overflow-hidden"
        style={{
          background: "var(--prism-bg)",
          border: "1px solid var(--prism-border)",
          fontFamily: "var(--font-mono)",
          fontSize: "13px",
          boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
        }}
      >
        <div
          className="px-4 py-3 border-b flex items-center gap-3"
          style={{ borderColor: "var(--prism-border)" }}
        >
          <span style={{ color: "var(--prism-accent)", fontWeight: 700 }}>?</span>
          <span style={{ color: "var(--prism-muted)" }}>Editor keybindings</span>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="filter..."
            className="flex-1 bg-transparent outline-none"
            style={{ color: "var(--prism-fg)", fontFamily: "inherit" }}
          />
          <span style={{ color: "var(--prism-muted)", fontSize: "11px" }}>esc / ? to close</span>
        </div>
        <div className="overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
          {grouped.length === 0 ? (
            <div className="px-4 py-8 text-center" style={{ color: "var(--prism-muted)" }}>
              No matches
            </div>
          ) : (
            grouped.map(([group, items]) => (
              <div key={group} className="py-2">
                <div
                  className="px-4 py-1 text-xs uppercase tracking-wider"
                  style={{ color: "var(--prism-muted)" }}
                >
                  {group}
                </div>
                {items.map((b, i) => (
                  <div
                    key={`${group}-${i}`}
                    className="px-4 py-1 grid items-center gap-4"
                    style={{ gridTemplateColumns: "220px 1fr" }}
                  >
                    <span style={{ color: "var(--prism-accent)" }}>{b.keys}</span>
                    <span style={{ color: "var(--prism-fg)" }}>{b.desc}</span>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});
