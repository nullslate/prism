import { useCallback, useEffect, useRef, useState } from "react";
import { commands } from "@/lib/tauri";

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
      .catch((err) => console.error("Failed to create file:", err));
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
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="New file name..."
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
