import type { ButtonHTMLAttributes } from "react";

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props}
      className={`px-3 py-1.5 text-sm rounded ${props.className ?? ""}`}
      style={{ background: "var(--prism-accent)", color: "var(--prism-bg)", ...props.style }} />
  );
}
