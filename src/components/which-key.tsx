import { memo, useEffect, useState } from "react";
import type { KeyContinuation } from "@/hooks/use-shortcuts";

interface WhichKeyProps {
  continuations: KeyContinuation[];
  keySequence: string;
}

export const WhichKey = memo(function WhichKey({ continuations, keySequence }: WhichKeyProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (continuations.length === 0) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), 200);
    return () => clearTimeout(timer);
  }, [continuations]);

  if (!visible || continuations.length === 0) return null;

  return (
    <div
      className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-lg"
      style={{
        background: "var(--prism-code-bg)",
        border: "1px solid var(--prism-border)",
        fontFamily: "var(--font-mono)",
        fontSize: "13px",
        animation: "whichkey-fade-in 120ms ease-out",
        minWidth: "200px",
      }}
    >
      <style>{`@keyframes whichkey-fade-in { from { opacity: 0; transform: translateX(-50%) translateY(4px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`}</style>
      <div
        className="text-xs mb-2 pb-1 border-b"
        style={{ color: "var(--prism-muted)", borderColor: "var(--prism-border)" }}
      >
        {keySequence}...
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: "auto 1fr" }}>
        {continuations.map((c) => (
          <div key={c.key} className="contents">
            <span style={{ color: "var(--prism-accent)" }}>{c.key}</span>
            <span style={{ color: "var(--prism-muted)", paddingLeft: "12px" }}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});
