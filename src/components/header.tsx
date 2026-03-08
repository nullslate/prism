import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export function Header() {
  const win = getCurrentWebviewWindow();

  return (
    <header
      className="flex items-center justify-between h-9 px-3 border-b select-none shrink-0"
      style={{ borderColor: "var(--prism-border)", background: "var(--prism-bg)" }}
    >
      <div
        className="flex items-center gap-2 flex-1 cursor-default"
        data-tauri-drag-region
      >
        <span style={{ color: "var(--prism-accent)" }}>&#x2318;</span>
        <span className="text-sm font-semibold tracking-wider" style={{ color: "var(--prism-muted)" }}>
          PRISM
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => win.minimize()}
          className="w-7 h-7 flex items-center justify-center text-sm hover:opacity-80"
          style={{ color: "var(--prism-muted)" }}
        >
          &#x2500;
        </button>
        <button
          onClick={() => win.close()}
          className="w-7 h-7 flex items-center justify-center text-sm hover:opacity-80"
          style={{ color: "var(--prism-muted)" }}
        >
          &#x00D7;
        </button>
      </div>
    </header>
  );
}
