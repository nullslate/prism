import { useCallback, useEffect, useRef, useState } from "react";
import { commands } from "@/lib/tauri";
import { log } from "@/lib/logger";

interface NewFileDialogProps {
  onCreate: (path: string) => void;
  onClose: () => void;
}

export function NewFileDialog({ onCreate, onClose }: NewFileDialogProps) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const path = trimmed.endsWith(".md") ? trimmed : `${trimmed}.md`;
    commands
      .createFile(path)
      .then((actualPath) => onCreate(actualPath))
      .catch((err) => log.error("Failed to create file:", err));
  }, [name, onCreate]);

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
        <span style={{ color: "var(--prism-muted)" }}>&#x2B;</span>
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New file name..."
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
