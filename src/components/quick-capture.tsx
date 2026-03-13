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
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--prism-bg)" }}
    >
      <div
        className="flex items-center border-b px-3 gap-2"
        style={{ borderColor: "var(--prism-border)" }}
      >
        <span style={{ color: "var(--prism-muted)" }}>&#x2609;</span>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Quick capture..."
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
