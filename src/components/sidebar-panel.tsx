import { useCallback, useEffect, useState, type ReactNode } from "react";

interface SidebarPanelProps {
  visible: boolean;
  children: ReactNode;
}

export function SidebarPanel({ visible, children }: SidebarPanelProps) {
  const [mounted, setMounted] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
    }
  }, [visible, mounted]);

  const handleAnimationEnd = useCallback(() => {
    if (closing) {
      setMounted(false);
      setClosing(false);
    }
  }, [closing]);

  if (!mounted) return null;

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col overflow-hidden"
      style={{
        background: "var(--prism-sidebar-bg)",
        animation: `${closing ? "slide-out-left" : "slide-in-left"} var(--transition-normal) var(--ease-out) forwards`,
        pointerEvents: closing ? "none" : "auto",
      }}
      onAnimationEnd={handleAnimationEnd}
    >
      {children}
    </div>
  );
}
