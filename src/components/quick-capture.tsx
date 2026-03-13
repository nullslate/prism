import { useCallback, useEffect, useRef, useState } from "react";
import { commands } from "@/lib/tauri";
import { log } from "@/lib/logger";

interface QuickCaptureProps {
  onClose: () => void;
  onCapture?: () => void;
}

export function QuickCapture({ onClose, onCapture }: QuickCaptureProps) {
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const now = new Date();
    const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const formatted = `${ts} — ${trimmed}`;
    try {
      await commands.appendToInbox(formatted);
      onCapture?.();
      onClose();
    } catch (e) {
      log.error("Failed to capture:", e);
    }
  }, [text, onClose, onCapture]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        submit();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [submit, onClose],
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
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Quick capture..."
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
