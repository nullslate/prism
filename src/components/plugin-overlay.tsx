import { PluginErrorBoundary } from "./plugin-panel";

interface PluginOverlayProps {
  pluginName: string;
  component: React.ComponentType;
  onClose: () => void;
}

export function PluginOverlay({ pluginName, component: OverlayComponent, onClose }: PluginOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-[28rem] rounded border shadow-lg overflow-hidden"
        style={{
          background: "var(--prism-bg)",
          borderColor: "var(--prism-border)",
        }}
      >
        <PluginErrorBoundary pluginName={pluginName}>
          <OverlayComponent />
        </PluginErrorBoundary>
      </div>
    </div>
  );
}
