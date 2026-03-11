import { useEffect, useState, useCallback, useRef } from "react";
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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [stats, setStats] = useState({ nodes: 0, edges: 0 });
  const [loading, setLoading] = useState(true);
  const [allEdges, setAllEdges] = useState<GraphEdge[]>([]);
  const listRef = useRef<HTMLDivElement>(null);

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
    setSelectedIndex(0);
  }, [focusPath, allEdges]);

  // Scroll selected item into view
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const items = container.querySelectorAll<HTMLElement>("[data-graph-item]");
    items[selectedIndex]?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

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

  const allItems = neighbors;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      let handled = true;
      switch (e.key) {
        case "j":
        case "ArrowDown":
          setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
          break;
        case "k":
        case "ArrowUp":
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "l":
        case "ArrowRight":
          if (allItems[selectedIndex]) navigate(allItems[selectedIndex].path);
          break;
        case "h":
        case "ArrowLeft":
          if (history.length > 0) goBack();
          break;
        case "Enter":
          if (allItems[selectedIndex]) openAndClose(allItems[selectedIndex].path);
          break;
        case "g":
          setSelectedIndex(0);
          break;
        case "G":
          setSelectedIndex(Math.max(allItems.length - 1, 0));
          break;
        case "Escape":
          if (history.length > 0) goBack();
          else onClose();
          break;
        default:
          handled = false;
      }
      if (handled) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    }

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [allItems, selectedIndex, navigate, goBack, openAndClose, onClose, history.length, focusPath]);

  const focusLabel = focusPath ? labelFromPath(focusPath) : "No file selected";
  const outgoing = neighbors.filter((n) => n.direction === "outgoing" || n.direction === "both");
  const incoming = neighbors.filter((n) => n.direction === "incoming" || n.direction === "both");

  // Map flat selectedIndex to the right section
  let flatIndex = 0;

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
            <span
              className="text-sm font-medium truncate"
              style={{ color: "var(--prism-accent)" }}
              title={focusPath ?? undefined}
            >
              {focusLabel}
            </span>
          </div>
          <span className="text-xs shrink-0 ml-2" style={{ color: "var(--prism-muted)" }}>
            {loading ? "..." : `${stats.nodes}n ${stats.edges}e`}
          </span>
        </div>

        {/* Vim hints */}
        <div
          className="px-3 py-1 text-xs border-b shrink-0"
          style={{ color: "var(--prism-muted)", borderColor: "var(--prism-border)" }}
        >
          j/k nav | l explore | h back | enter open | esc close
        </div>

        {/* Body */}
        <div ref={listRef} className="overflow-y-auto flex-1 min-h-0">
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
              {outgoing.map((n) => {
                const idx = flatIndex++;
                return (
                  <div
                    key={n.path}
                    data-graph-item
                    className="flex items-center px-3 py-1.5 text-sm cursor-pointer"
                    style={{
                      fontFamily: "var(--font-mono)",
                      background: idx === selectedIndex ? "var(--prism-selection)" : "transparent",
                      color: idx === selectedIndex ? "var(--prism-accent)" : "var(--prism-fg)",
                    }}
                    onClick={() => openAndClose(n.path)}
                  >
                    <span className="truncate flex-1 min-w-0" title={n.path}>
                      {n.label}
                    </span>
                    {n.direction === "both" && (
                      <span className="text-xs ml-2 shrink-0" style={{ color: "var(--prism-muted)" }}>
                        mutual
                      </span>
                    )}
                  </div>
                );
              })}
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
              {incoming.map((n) => {
                const idx = flatIndex++;
                return (
                  <div
                    key={n.path}
                    data-graph-item
                    className="flex items-center px-3 py-1.5 text-sm cursor-pointer"
                    style={{
                      fontFamily: "var(--font-mono)",
                      background: idx === selectedIndex ? "var(--prism-selection)" : "transparent",
                      color: idx === selectedIndex ? "var(--prism-accent)" : "var(--prism-fg)",
                    }}
                    onClick={() => openAndClose(n.path)}
                  >
                    <span className="truncate flex-1 min-w-0" title={n.path}>
                      {n.label}
                    </span>
                    {n.direction === "both" && (
                      <span className="text-xs ml-2 shrink-0" style={{ color: "var(--prism-muted)" }}>
                        mutual
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
