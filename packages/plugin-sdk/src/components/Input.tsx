import type { InputHTMLAttributes } from "react";

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input {...props}
      className={`w-full px-3 py-2 text-sm rounded border outline-none ${props.className ?? ""}`}
      style={{ background: "var(--prism-code-bg)", color: "var(--prism-fg)",
        borderColor: "var(--prism-border)", ...props.style }} />
  );
}
