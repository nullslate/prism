import { useCallback, useEffect, useState, type ReactNode } from "react";

interface AnimatedOverlayProps {
  visible: boolean;
  children: ReactNode;
}

export function AnimatedOverlay({ visible, children }: AnimatedOverlayProps) {
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
      className="absolute inset-0 z-50 flex flex-col overflow-hidden"
      style={{
        background: "var(--prism-bg)",
        animation: `${closing ? "overlay-out" : "overlay-in"} var(--transition-fast) var(--ease-out) forwards`,
        pointerEvents: closing ? "none" : "auto",
      }}
      onAnimationEnd={handleAnimationEnd}
    >
      {children}
    </div>
  );
}
