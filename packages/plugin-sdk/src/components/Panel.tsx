import type { ReactNode } from "react";

interface PanelProps { title: string; children: ReactNode }

export function Panel({ title, children }: PanelProps) {
  return (
    <div className="border-t" style={{ borderColor: "var(--prism-border)" }}>
      <div className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest"
        style={{ color: "var(--prism-muted)" }}>{title}</div>
      <div className="px-3 pb-2">{children}</div>
    </div>
  );
}
