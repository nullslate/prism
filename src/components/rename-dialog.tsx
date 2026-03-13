import { useCallback, useEffect, useRef, useState } from "react";
import { commands } from "@/lib/tauri";
import { log } from "@/lib/logger";

interface RenameDialogProps {
  currentPath: string;
  onRename: (newPath: string) => void;
  onClose: () => void;
}

export function RenameDialog({ currentPath, onRename, onClose }: RenameDialogProps) {
  const [name, setName] = useState(currentPath);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentPath) return;
    const newPath = trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`;
    commands
      .renameFile(currentPath, newPath)
      .then((actualPath) => onRename(actualPath))
      .catch((err) => log.error("Failed to rename file:", err));
  }, [name, currentPath, onRename]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [handleSubmit, onClose],
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
        <div
          className="px-3 py-1.5 text-xs uppercase tracking-widest border-b"
          style={{
            color: "var(--prism-muted)",
            borderColor: "var(--prism-border)",
            fontFamily: "var(--font-mono)",
          }}
        >
          Rename / Move
        </div>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New file path..."
          className="w-full px-3 py-2 text-sm outline-none"
          style={{
            background: "var(--prism-bg)",
            color: "var(--prism-fg)",
            fontFamily: "var(--font-mono)",
          }}
        />
      </div>
    </div>
  );
}
