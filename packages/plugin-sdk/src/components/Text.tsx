import type { HTMLAttributes } from "react";

interface TextProps extends HTMLAttributes<HTMLSpanElement> { muted?: boolean }

export function Text({ muted, style, ...props }: TextProps) {
  return <span {...props}
    style={{ color: muted ? "var(--prism-muted)" : "var(--prism-fg)", ...style }} />;
}
