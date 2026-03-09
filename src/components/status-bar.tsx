import { memo } from "react";
import { useReader } from "@/components/reader-provider";

interface StatusBarProps {
  filePath: string | null;
  content: string;
}

export const StatusBar = memo(function StatusBar({ filePath, content }: StatusBarProps) {
  const { state } = useReader();
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
          className="px-1.5 text-xs font-bold uppercase"
          style={{ color: state.editorOpen ? "var(--prism-accent)" : "var(--prism-muted)" }}
        >
          {mode}
        </span>
        <span>{filePath ?? "No file selected"}</span>
      </div>
      <div className="flex items-center gap-3">
        {filePath && <span>{wordCount}w</span>}
        {state.keySequence && (
          <span style={{ color: "var(--prism-fg)" }}>{state.keySequence}</span>
        )}
      </div>
    </footer>
  );
});
