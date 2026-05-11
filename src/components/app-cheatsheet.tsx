import { memo, useEffect, useMemo, useState } from "react";
import type { ShortcutConfig } from "@/lib/types";

interface AppCheatsheetProps {
  visible: boolean;
  shortcuts: ShortcutConfig | null;
  onClose: () => void;
}

const ACTION_META: Record<string, { label: string; group: string; scope: "global" | "render" }> = {
  // Global
  "find-file": { label: "Find file", group: "Find", scope: "global" },
  "vault-search": { label: "Search vault (grep)", group: "Find", scope: "global" },
  "filter-tags": { label: "Filter by tag", group: "Find", scope: "global" },
  "link-graph": { label: "Link graph", group: "Find", scope: "global" },
  "command-palette": { label: "Command palette", group: "Find", scope: "global" },

  "toggle-sidebar": { label: "Toggle sidebar (files)", group: "View", scope: "global" },
  "cycle-theme": { label: "Switch theme", group: "View", scope: "global" },
  "close-overlay": { label: "Close overlay / dialog", group: "View", scope: "global" },

  "new-file": { label: "New file", group: "Create", scope: "global" },
  "new-from-template": { label: "New from template", group: "Create", scope: "global" },
  "daily-note": { label: "Daily note", group: "Create", scope: "global" },
  "quick-capture": { label: "Quick capture to inbox", group: "Create", scope: "global" },
  "set-vault": { label: "Set vault folder", group: "Create", scope: "global" },

  // Reader-mode
  "scroll-down": { label: "Scroll down", group: "Reader · Navigate", scope: "render" },
  "scroll-up": { label: "Scroll up", group: "Reader · Navigate", scope: "render" },
  "scroll-left": { label: "Scroll left", group: "Reader · Navigate", scope: "render" },
  "scroll-right": { label: "Scroll right", group: "Reader · Navigate", scope: "render" },
  "page-down": { label: "Half page down", group: "Reader · Navigate", scope: "render" },
  "page-up": { label: "Half page up", group: "Reader · Navigate", scope: "render" },
  "goto-top": { label: "Go to top", group: "Reader · Navigate", scope: "render" },
  "goto-bottom": { label: "Go to bottom", group: "Reader · Navigate", scope: "render" },
  "jump-back": { label: "Jump back (prev file)", group: "Reader · Navigate", scope: "render" },
  "jump-forward": { label: "Jump forward (next file)", group: "Reader · Navigate", scope: "render" },

  "open-editor": { label: "Open in editor", group: "Reader · Action", scope: "render" },
  "search-in-file": { label: "Search in file", group: "Reader · Action", scope: "render" },
  "toggle-todo": { label: "Toggle nearest todo", group: "Reader · Action", scope: "render" },
  "trash-file": { label: "Trash file (press twice)", group: "Reader · Action", scope: "render" },
  "quit": { label: "Quit Prism", group: "Reader · Action", scope: "render" },
};

function formatKey(key: string): string {
  // Chord like "g g" stays as "gg"; ctrl combos uppercase the parts
  if (!key) return "";
  if (key.includes(" ") && !key.includes("+")) return key.replace(/\s+/g, "");
  return key
    .split("+")
    .map((p) => p.length === 1 ? p.toUpperCase() : p.charAt(0).toUpperCase() + p.slice(1))
    .join("+");
}

interface Row {
  key: string;
  label: string;
  group: string;
  actionId: string;
}

export const AppCheatsheet = memo(function AppCheatsheet({ visible, shortcuts, onClose }: AppCheatsheetProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!visible) {
      setQuery("");
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" || (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [visible, onClose]);

  const rows = useMemo<Row[]>(() => {
    if (!shortcuts) return [];
    const out: Row[] = [];
    for (const [actionId, key] of Object.entries(shortcuts.global)) {
      const meta = ACTION_META[actionId];
      out.push({
        key: formatKey(key),
        label: meta?.label ?? actionId,
        group: meta?.group ?? "Other",
        actionId,
      });
    }
    for (const [actionId, key] of Object.entries(shortcuts.render)) {
      if (actionId.startsWith("favorite-")) continue;
      const meta = ACTION_META[actionId];
      out.push({
        key: formatKey(key),
        label: meta?.label ?? actionId,
        group: meta?.group ?? "Reader",
        actionId,
      });
    }
    // Add favorites as a single line
    const favKeys = Object.entries(shortcuts.render)
      .filter(([id]) => id.startsWith("favorite-"))
      .sort();
    if (favKeys.length > 0) {
      const range = `${favKeys[0][1]}–${favKeys[favKeys.length - 1][1]}`;
      out.push({ key: range, label: "Open favorite 1–9", group: "Reader · Action", actionId: "favorites" });
    }
    // Add ? itself
    out.push({ key: "?", label: "Toggle this cheatsheet", group: "View", actionId: "help" });
    return out;
  }, [shortcuts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.key.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q) ||
        r.group.toLowerCase().includes(q),
    );
  }, [query, rows]);

  const grouped = useMemo(() => {
    const map = new Map<string, Row[]>();
    const order = [
      "Find",
      "View",
      "Create",
      "Reader · Navigate",
      "Reader · Action",
      "Other",
      "Reader",
    ];
    for (const r of filtered) {
      if (!map.has(r.group)) map.set(r.group, []);
      map.get(r.group)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => {
      const ai = order.indexOf(a[0]);
      const bi = order.indexOf(b[0]);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
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
          <span style={{ color: "var(--prism-muted)" }}>Keybindings</span>
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
                {items.map((r) => (
                  <div
                    key={r.actionId}
                    className="px-4 py-1 grid items-center gap-4"
                    style={{ gridTemplateColumns: "160px 1fr" }}
                  >
                    <span style={{ color: "var(--prism-accent)" }}>{r.key}</span>
                    <span style={{ color: "var(--prism-fg)" }}>{r.label}</span>
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
