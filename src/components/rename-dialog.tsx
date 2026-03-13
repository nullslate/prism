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
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--prism-bg)" }}
    >
      <div
        className="flex items-center border-b px-3 gap-2"
        style={{ borderColor: "var(--prism-border)" }}
      >
        <span style={{ color: "var(--prism-muted)" }}>&#x21C4;</span>
        <span
          className="text-xs uppercase tracking-widest"
          style={{ color: "var(--prism-muted)", fontFamily: "var(--font-mono)" }}
        >
          Rename / Move
        </span>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New file path..."
          className="flex-1 py-2.5 text-sm outline-none"
          style={{
            background: "transparent",
            color: "var(--prism-fg)",
            fontFamily: "var(--font-mono)",
          }}
        />
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center text-sm hover:opacity-80"
          style={{ color: "var(--prism-muted)" }}
        >
          &#x00D7;
        </button>
      </div>
    </div>
  );
}
