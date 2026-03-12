import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  pluginName: string;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: string | null;
}

export class PluginErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="px-3 py-2 text-xs"
          style={{ color: "var(--prism-syntax-string)" }}
        >
          Plugin "{this.props.pluginName}" error: {this.state.error}
        </div>
      );
    }
    return this.props.children;
  }
}
