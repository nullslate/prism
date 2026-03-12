import { useState, useEffect } from "react";

const DIGITS: Record<string, string[]> = {
  "0": ["┌─┐", "│ │", "│ │", "│ │", "└─┘"],
  "1": ["  ┐", "  │", "  │", "  │", "  ╵"],
  "2": ["┌─┐", "  │", "┌─┘", "│  ", "└──"],
  "3": ["┌─┐", "  │", " ─┤", "  │", "└─┘"],
  "4": ["╷ ╷", "│ │", "└─┤", "  │", "  ╵"],
  "5": ["┌──", "│  ", "└─┐", "  │", "└─┘"],
  "6": ["┌─┐", "│  ", "├─┐", "│ │", "└─┘"],
  "7": ["┌──", "  │", "  │", "  │", "  ╵"],
  "8": ["┌─┐", "│ │", "├─┤", "│ │", "└─┘"],
  "9": ["┌─┐", "│ │", "└─┤", "  │", "└─┘"],
  ":": ["   ", " ● ", "   ", " ● ", "   "],
};

function renderTime(h: number, m: number, s: number): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const chars = `${pad(h)}:${pad(m)}:${pad(s)}`.split("");

  const lines: string[] = [];
  for (let row = 0; row < 5; row++) {
    lines.push(chars.map((c) => DIGITS[c]?.[row] ?? "   ").join(" "));
  }
  return lines.join("\n");
}

export const sidebar = () => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const ascii = renderTime(now.getHours(), now.getMinutes(), now.getSeconds());

  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="border-t" style={{ borderColor: "var(--prism-border)" }}>
      <div
        className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest"
        style={{ color: "var(--prism-muted)" }}
      >
        Clock
      </div>
      <div className="px-3 pb-2">
        <pre
          style={{
            color: "var(--prism-accent)",
            fontSize: "9px",
            lineHeight: "1.2",
            fontFamily: "var(--font-mono)",
            textAlign: "center",
            margin: 0,
            padding: "4px 0",
          }}
        >
          {ascii}
        </pre>
        <div
          style={{
            color: "var(--prism-muted)",
            fontSize: "11px",
            textAlign: "center",
            paddingTop: "4px",
          }}
        >
          {dateStr}
        </div>
      </div>
    </div>
  );
};
