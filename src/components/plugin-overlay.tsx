import { PluginErrorBoundary } from "./plugin-panel";

interface PluginOverlayProps {
  pluginName: string;
  component: React.ComponentType;
  onClose: () => void;
}

export function PluginOverlay({ pluginName, component: OverlayComponent, onClose }: PluginOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "var(--prism-bg)" }}
    >
      <div
        className="flex items-center border-b px-3 gap-2"
        style={{ borderColor: "var(--prism-border)" }}
      >
        <span style={{ color: "var(--prism-muted)" }}>&#x2699;</span>
        <span
          className="flex-1 py-2.5 text-sm"
          style={{ color: "var(--prism-fg)", fontFamily: "var(--font-mono)" }}
        >
          {pluginName}
        </span>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center text-sm hover:opacity-80"
          style={{ color: "var(--prism-muted)" }}
        >
          &#x00D7;
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <PluginErrorBoundary pluginName={pluginName}>
          <OverlayComponent />
        </PluginErrorBoundary>
      </div>
    </div>
  );
}
