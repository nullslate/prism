import { memo, useEffect, useState } from "react";
import { useReader } from "@/components/reader-provider";
import { usePrism } from "@/components/prism-provider";
import type { VimMode } from "@/lib/reader-state";

interface StatusBarProps {
  filePath: string | null;
  content: string;
}

function modeColor(mode: VimMode): { bg: string; fg: string } {
  switch (mode) {
    case "INSERT":
      return { bg: "#a6e3a1", fg: "var(--prism-bg)" };
    case "VISUAL":
    case "V-LINE":
    case "V-BLOCK":
      return { bg: "#f9e2af", fg: "var(--prism-bg)" };
    case "REPLACE":
      return { bg: "#f38ba8", fg: "var(--prism-bg)" };
    case "EX":
      return { bg: "#cba6f7", fg: "var(--prism-bg)" };
    case "NORMAL":
    default:
      return { bg: "var(--prism-accent)", fg: "var(--prism-bg)" };
  }
}

export const StatusBar = memo(function StatusBar({ filePath, content }: StatusBarProps) {
  const { state } = useReader();
  const { pluginStatusItems } = usePrism();
  const wordCount = content ? content.split(/\s+/).filter(Boolean).length : 0;
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    if (!state.saveFlash) return;
    setFlash(true);
    const timer = setTimeout(() => setFlash(false), 300);
    return () => clearTimeout(timer);
  }, [state.saveFlash]);

  const label = state.editorOpen ? state.vimMode : "READER";
  const colors = state.editorOpen ? modeColor(state.vimMode) : { bg: "var(--prism-selection)", fg: "var(--prism-muted)" };

  return (
    <footer
      className="flex items-center justify-between h-8 px-3 text-sm border-t shrink-0"
      style={{
        borderColor: "var(--prism-border)",
        background: "var(--prism-sidebar-bg)",
        color: "var(--prism-muted)",
        fontFamily: "var(--font-mono)",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="px-2 py-0.5 text-xs font-bold uppercase rounded"
          style={{
            color: flash ? "var(--prism-bg)" : colors.fg,
            background: flash ? "#a6e3a1" : colors.bg,
            transition: "all 120ms ease-out",
            minWidth: "62px",
            textAlign: "center",
          }}
        >
          {label}
        </span>
        <span>{filePath ?? "No file selected"}</span>
      </div>
      <div className="flex items-center gap-3">
        {pluginStatusItems.filter(s => s.text).map((item) => (
          <span key={`${item.plugin}:${item.id}`}>{item.text}</span>
        ))}
        {filePath && <span>{wordCount}w</span>}
        {state.editorOpen && (
          <span style={{ color: "var(--prism-muted)", opacity: 0.7 }}>?=help</span>
        )}
        {state.keySequence && (
          <span style={{ color: "var(--prism-accent)", fontWeight: 600 }}>
            {state.keySequence}
          </span>
        )}
      </div>
    </footer>
  );
});
