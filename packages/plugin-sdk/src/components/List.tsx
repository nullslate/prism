import type { ReactNode } from "react";

export function List({ children }: { children: ReactNode }) {
  return <ul className="space-y-0.5">{children}</ul>;
}

interface ListItemProps { label: string; value?: string | number | null; onClick?: () => void }

export function ListItem({ label, value, onClick }: ListItemProps) {
  const Tag = onClick ? "button" : "li";
  return (
    <Tag className="flex justify-between w-full px-2 py-1 text-sm rounded hover:bg-[var(--prism-selection)] cursor-default"
      style={{ color: "var(--prism-fg)" }} onClick={onClick}>
      <span>{label}</span>
      {value != null && <span style={{ color: "var(--prism-muted)" }}>{value}</span>}
    </Tag>
  );
}
