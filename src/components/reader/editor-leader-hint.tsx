import { memo } from "react";

interface LeaderItem {
  key: string;
  label: string;
  group?: boolean;
}

const TOP_LEVEL: LeaderItem[] = [
  { key: "w", label: "save + back to reader" },
  { key: "x", label: "save + back to reader" },
  { key: "s", label: "save (stay in editor)" },
  { key: "q", label: "close editor (no save)" },
  { key: "e", label: "back to reader" },
  { key: "?", label: "cheatsheet" },
  { key: "f", label: "+find...", group: true },
  { key: "t", label: "+todo...", group: true },
  { key: "y", label: "+yank...", group: true },
  { key: "g", label: "+goto...", group: true },
];

const F_GROUP: LeaderItem[] = [
  { key: "f", label: "find file" },
  { key: "g", label: "grep vault" },
  { key: "b", label: "buffers (recent)" },
  { key: "p", label: "command palette" },
];

const T_GROUP: LeaderItem[] = [
  { key: "t", label: "toggle todo" },
  { key: "n", label: "new todo below" },
  { key: "a", label: "wrap as todo" },
];

const Y_GROUP: LeaderItem[] = [
  { key: "y", label: "yank line to system clipboard" },
];

const G_GROUP: LeaderItem[] = [
  { key: "f", label: "follow wiki link" },
  { key: "d", label: "follow wiki link (alias)" },
];

function itemsFor(suffix: string): LeaderItem[] {
  if (suffix === "") return TOP_LEVEL;
  if (suffix === "f") return F_GROUP;
  if (suffix === "t") return T_GROUP;
  if (suffix === "y") return Y_GROUP;
  if (suffix === "g") return G_GROUP;
  return [];
}

interface LeaderHintProps {
  visible: boolean;
  suffix: string;
}

export const EditorLeaderHint = memo(function EditorLeaderHint({ visible, suffix }: LeaderHintProps) {
  if (!visible) return null;
  const items = itemsFor(suffix);
  if (items.length === 0) return null;

  return (
    <div
      className="absolute bottom-2 left-1/2 -translate-x-1/2 z-40 px-4 py-3 rounded-lg pointer-events-none"
      style={{
        background: "var(--prism-code-bg)",
        border: "1px solid var(--prism-border)",
        fontFamily: "var(--font-mono)",
        fontSize: "12px",
        minWidth: "260px",
        maxWidth: "min(520px, 90%)",
        boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
      }}
    >
      <div
        className="text-xs mb-2 pb-1 border-b"
        style={{ color: "var(--prism-muted)", borderColor: "var(--prism-border)" }}
      >
        &lt;Space&gt;{suffix}...
      </div>
      <div className="grid gap-x-3 gap-y-1" style={{ gridTemplateColumns: "auto 1fr" }}>
        {items.map((it) => (
          <div key={it.key} className="contents">
            <span style={{ color: "var(--prism-accent)" }}>{it.key}</span>
            <span style={{ color: it.group ? "var(--prism-muted)" : "var(--prism-fg)" }}>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
