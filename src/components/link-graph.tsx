import { useEffect, useState, useCallback } from "react";
import { commands } from "@/lib/tauri";
import type { GraphEdge } from "@/lib/types";

interface LinkGraphProps {
  currentPath: string | null;
  onSelect: (path: string) => void;
  onClose: () => void;
}

interface Neighbor {
  path: string;
  label: string;
  direction: "outgoing" | "incoming" | "both";
}

function labelFromPath(path: string): string {
  return path.split("/").pop()?.replace(/\.md$/, "") ?? path;
}

export function LinkGraph({ currentPath, onSelect, onClose }: LinkGraphProps) {
  const [focusPath, setFocusPath] = useState(currentPath);
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });
  const [loading, setLoading] = useState(true);
  const [allEdges, setAllEdges] = useState<GraphEdge[]>([]);

  useEffect(() => {
    commands.getLinkGraph().then((graph) => {
      setAllEdges(graph.edges);
      setStats({ nodes: graph.nodes.length, edges: graph.edges.length });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!focusPath || allEdges.length === 0) {
      setNeighbors([]);
      return;
    }

    const outgoing = new Map<string, "outgoing">();
    const incoming = new Map<string, "incoming">();

    for (const e of allEdges) {
      if (e.source === focusPath && e.target !== focusPath) {
        outgoing.set(e.target, "outgoing");
      }
      if (e.target === focusPath && e.source !== focusPath) {
        incoming.set(e.source, "incoming");
      }
    }

    const merged = new Map<string, "outgoing" | "incoming" | "both">();
    for (const [path] of outgoing) {
      merged.set(path, incoming.has(path) ? "both" : "outgoing");
    }
    for (const [path] of incoming) {
      if (!merged.has(path)) merged.set(path, "incoming");
    }

    const result: Neighbor[] = [];
    for (const [path, direction] of merged) {
      result.push({ path, label: labelFromPath(path), direction });
    }
    result.sort((a, b) => a.label.localeCompare(b.label));
    setNeighbors(result);
  }, [focusPath, allEdges]);

  const navigate = useCallback((path: string) => {
    if (focusPath) setHistory((h) => [...h, focusPath]);
    setFocusPath(path);
  }, [focusPath]);

  const goBack = useCallback(() => {
    setHistory((h) => {
      const next = [...h];
      const prev = next.pop();
      if (prev) setFocusPath(prev);
      return next;
    });
  }, []);

  const openAndClose = useCallback((path: string) => {
    onSelect(path);
    onClose();
  }, [onSelect, onClose]);

  const focusLabel = focusPath ? labelFromPath(focusPath) : "No file selected";
  const outgoing = neighbors.filter((n) => n.direction === "outgoing" || n.direction === "both");
  const incoming = neighbors.filter((n) => n.direction === "incoming" || n.direction === "both");

  return (
    <div
      className="fixed inset-0 flex items-start justify-center pt-8 z-50"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-[26rem] max-h-[80vh] border shadow-lg rounded flex flex-col"
        style={{
          background: "var(--prism-bg)",
          borderColor: "var(--prism-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-3 py-2 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: "var(--prism-border)" }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {history.length > 0 && (
              <button
                onClick={goBack}
                className="text-xs px-1.5 py-0.5 rounded shrink-0"
                style={{ color: "var(--prism-accent)", border: "1px solid var(--prism-border)" }}
              >
                &larr;
              </button>
            )}
            <button
              onClick={() => focusPath && openAndClose(focusPath)}
              className="text-sm font-medium truncate text-left"
              style={{ color: "var(--prism-accent)" }}
              title={focusPath ?? undefined}
            >
              {focusLabel}
            </button>
          </div>
          <span className="text-xs shrink-0 ml-2" style={{ color: "var(--prism-muted)" }}>
            {loading ? "..." : `${stats.nodes}n ${stats.edges}e`}
          </span>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {!focusPath && (
            <div className="px-3 py-4 text-sm" style={{ color: "var(--prism-muted)" }}>
              Open a file to explore its links
            </div>
          )}

          {focusPath && neighbors.length === 0 && !loading && (
            <div className="px-3 py-4 text-sm" style={{ color: "var(--prism-muted)" }}>
              No links to or from this note
            </div>
          )}

          {outgoing.length > 0 && (
            <div>
              <div
                className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest"
                style={{ color: "var(--prism-muted)" }}
              >
                Links to ({outgoing.length})
              </div>
              {outgoing.map((n) => (
                <NeighborRow
                  key={n.path}
                  neighbor={n}
                  onNavigate={navigate}
                  onOpen={openAndClose}
                />
              ))}
            </div>
          )}

          {incoming.length > 0 && (
            <div>
              <div
                className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest"
                style={{ color: "var(--prism-muted)" }}
              >
                Linked from ({incoming.length})
              </div>
              {incoming.map((n) => (
                <NeighborRow
                  key={n.path}
                  neighbor={n}
                  onNavigate={navigate}
                  onOpen={openAndClose}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NeighborRow({
  neighbor,
  onNavigate,
  onOpen,
}: {
  neighbor: Neighbor;
  onNavigate: (path: string) => void;
  onOpen: (path: string) => void;
}) {
  return (
    <div
      className="flex items-center px-3 py-1.5 text-sm group"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      <button
        onClick={() => onOpen(neighbor.path)}
        className="truncate text-left flex-1 min-w-0"
        style={{ color: "var(--prism-fg)" }}
        title={neighbor.path}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--prism-accent)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--prism-fg)")}
      >
        {neighbor.label}
      </button>
      <button
        onClick={() => onNavigate(neighbor.path)}
        className="text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 shrink-0 ml-2"
        style={{ color: "var(--prism-muted)", border: "1px solid var(--prism-border)" }}
        title="Explore links"
      >
        &rarr;
      </button>
    </div>
  );
}
