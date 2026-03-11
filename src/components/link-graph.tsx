import { useEffect, useRef, useCallback } from "react";
import { commands } from "@/lib/tauri";
import type { GraphNode, GraphEdge } from "@/lib/types";

interface LinkGraphProps {
  currentPath: string | null;
  onSelect: (path: string) => void;
  onClose: () => void;
}

interface SimNode {
  id: string;
  label: string;
  path: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

function runSimulation(
  nodes: SimNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
) {
  const iterations = 200;
  const repulsion = 800;
  const springLength = 120;
  const springStrength = 0.02;
  const damping = 0.9;
  const centerPull = 0.01;

  const cx = width / 2;
  const cy = height / 2;

  for (let iter = 0; iter < iterations; iter++) {
    // Repulsion between all node pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) dist = 1;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx -= fx;
        a.vy -= fy;
        b.vx += fx;
        b.vy += fy;
      }
    }

    // Spring forces along edges
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    for (const edge of edges) {
      const a = nodeMap.get(edge.source);
      const b = nodeMap.get(edge.target);
      if (!a || !b) continue;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) dist = 1;
      const displacement = dist - springLength;
      const force = springStrength * displacement;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // Center gravity
    for (const node of nodes) {
      node.vx += (cx - node.x) * centerPull;
      node.vy += (cy - node.y) * centerPull;
    }

    // Integrate
    for (const node of nodes) {
      node.vx *= damping;
      node.vy *= damping;
      node.x += node.vx;
      node.y += node.vy;
    }
  }

  // Fit to viewport with padding
  if (nodes.length === 0) return;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.x > maxX) maxX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.y > maxY) maxY = n.y;
  }
  const padding = 80;
  const graphW = maxX - minX || 1;
  const graphH = maxY - minY || 1;
  const scaleX = (width - padding * 2) / graphW;
  const scaleY = (height - padding * 2) / graphH;
  const scale = Math.min(scaleX, scaleY, 1.5);
  const offsetX = width / 2 - ((minX + maxX) / 2) * scale;
  const offsetY = height / 2 - ((minY + maxY) / 2) * scale;
  for (const n of nodes) {
    n.x = n.x * scale + offsetX;
    n.y = n.y * scale + offsetY;
  }
}

function drawGraph(
  ctx: CanvasRenderingContext2D,
  nodes: SimNode[],
  edges: GraphEdge[],
  currentPath: string | null,
  hoveredNode: SimNode | null,
  width: number,
  height: number,
) {
  ctx.clearRect(0, 0, width, height);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // Get CSS variable values
  const root = document.documentElement;
  const accent = getComputedStyle(root).getPropertyValue("--prism-accent").trim() || "#7c3aed";
  const fg = getComputedStyle(root).getPropertyValue("--prism-fg").trim() || "#e0e0e0";
  const muted = getComputedStyle(root).getPropertyValue("--prism-muted").trim() || "#888";
  const border = getComputedStyle(root).getPropertyValue("--prism-border").trim() || "#333";

  // Draw edges
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;
  for (const edge of edges) {
    const a = nodeMap.get(edge.source);
    const b = nodeMap.get(edge.target);
    if (!a || !b) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Draw nodes
  const nodeRadius = 6;
  for (const node of nodes) {
    const isCurrent = node.path === currentPath;
    const isHovered = hoveredNode?.id === node.id;

    ctx.beginPath();
    ctx.arc(node.x, node.y, isHovered ? nodeRadius + 2 : nodeRadius, 0, Math.PI * 2);

    if (isCurrent) {
      ctx.fillStyle = accent;
    } else if (isHovered) {
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.7;
    } else {
      ctx.fillStyle = muted;
    }
    ctx.fill();
    ctx.globalAlpha = 1;

    // Label
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = isCurrent ? accent : fg;
    ctx.globalAlpha = isCurrent || isHovered ? 1 : 0.7;
    ctx.fillText(node.label, node.x, node.y + nodeRadius + 14);
    ctx.globalAlpha = 1;
  }
}

export function LinkGraph({ currentPath, onSelect, onClose }: LinkGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const hoveredRef = useRef<SimNode | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawGraph(
      ctx,
      nodesRef.current,
      edgesRef.current,
      currentPath,
      hoveredRef.current,
      sizeRef.current.width,
      sizeRef.current.height,
    );
  }, [currentPath]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
      sizeRef.current = { width: w, height: h };
    };

    resize();

    commands.getLinkGraph().then((graph) => {
      const w = sizeRef.current.width;
      const h = sizeRef.current.height;

      const simNodes: SimNode[] = graph.nodes.map((n: GraphNode) => ({
        ...n,
        x: w / 2 + (Math.random() - 0.5) * w * 0.5,
        y: h / 2 + (Math.random() - 0.5) * h * 0.5,
        vx: 0,
        vy: 0,
      }));

      runSimulation(simNodes, graph.edges, w, h);
      nodesRef.current = simNodes;
      edgesRef.current = graph.edges;
      redraw();
    }).catch(console.error);

    const ro = new ResizeObserver(() => {
      resize();
      if (nodesRef.current.length > 0) {
        runSimulation(nodesRef.current, edgesRef.current, sizeRef.current.width, sizeRef.current.height);
        redraw();
      }
    });
    ro.observe(parent);

    return () => ro.disconnect();
  }, [redraw]);

  const findNodeAt = useCallback((x: number, y: number): SimNode | null => {
    const hitRadius = 12;
    for (const node of nodesRef.current) {
      const dx = node.x - x;
      const dy = node.y - y;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return node;
      }
    }
    return null;
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const node = findNodeAt(x, y);
    if (node !== hoveredRef.current) {
      hoveredRef.current = node;
      canvas.style.cursor = node ? "pointer" : "default";
      redraw();
    }
  }, [findNodeAt, redraw]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const node = findNodeAt(x, y);
    if (node) {
      onSelect(node.path);
      onClose();
    }
  }, [findNodeAt, onSelect, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0, 0, 0, 0.75)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-[90vw] h-[85vh] rounded-lg overflow-hidden"
        style={{
          background: "var(--prism-bg)",
          border: "1px solid var(--prism-border)",
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-2 text-sm"
          style={{
            borderBottom: "1px solid var(--prism-border)",
            color: "var(--prism-fg)",
          }}
        >
          <span style={{ color: "var(--prism-accent)" }}>Link Graph</span>
          <span style={{ color: "var(--prism-muted)", fontSize: "11px" }}>
            Click node to open | Esc to close
          </span>
        </div>
        <div className="relative" style={{ height: "calc(100% - 37px)" }}>
          <canvas
            ref={canvasRef}
            onMouseMove={handleMouseMove}
            onClick={handleClick}
          />
        </div>
      </div>
    </div>
  );
}
