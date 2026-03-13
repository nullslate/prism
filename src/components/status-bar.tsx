import { memo } from "react";
import { useReader } from "@/components/reader-provider";
import { usePrism } from "@/components/prism-provider";

interface StatusBarProps {
  filePath: string | null;
  content: string;
}

export const StatusBar = memo(function StatusBar({ filePath, content }: StatusBarProps) {
  const { state } = useReader();
  const { pluginStatusItems } = usePrism();
  const wordCount = content ? content.split(/\s+/).filter(Boolean).length : 0;
  const mode = state.editorOpen ? "EDITOR" : "RENDER";

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
            color: state.editorOpen ? "var(--prism-bg)" : "var(--prism-muted)",
            background: state.editorOpen ? "var(--prism-accent)" : "var(--prism-selection)",
            transition: "all 120ms ease-out",
          }}
        >
          {mode}
        </span>
        <span>{filePath ?? "No file selected"}</span>
      </div>
      <div className="flex items-center gap-3">
        {pluginStatusItems.filter(s => s.text).map((item) => (
          <span key={`${item.plugin}:${item.id}`}>{item.text}</span>
        ))}
        {filePath && <span>{wordCount}w</span>}
        {state.keySequence && (
          <span style={{ color: "var(--prism-accent)", fontWeight: 600 }}>
            {state.keySequence}
          </span>
        )}
      </div>
    </footer>
  );
});
