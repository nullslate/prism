import type { ReactNode } from "react";

interface OverlayProps { children: ReactNode; onClose?: () => void }

export function Overlay({ children, onClose }: OverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="w-[28rem] rounded border shadow-lg overflow-hidden"
        style={{ background: "var(--prism-bg)", borderColor: "var(--prism-border)" }}>
        {children}
      </div>
    </div>
  );
}
