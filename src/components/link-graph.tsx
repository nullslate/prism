import { useEffect, useRef, useCallback, useState } from "react";
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

interface Camera {
  x: number;
  y: number;
  zoom: number;
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

    for (const node of nodes) {
      node.vx += (cx - node.x) * centerPull;
      node.vy += (cy - node.y) * centerPull;
    }

    for (const node of nodes) {
      node.vx *= damping;
      node.vy *= damping;
      node.x += node.vx;
      node.y += node.vy;
    }
  }
}

function screenToWorld(sx: number, sy: number, cam: Camera): { x: number; y: number } {
  return {
    x: (sx - cam.x) / cam.zoom,
    y: (sy - cam.y) / cam.zoom,
  };
}

function drawGraph(
  ctx: CanvasRenderingContext2D,
  nodes: SimNode[],
  edges: GraphEdge[],
  currentPath: string | null,
  hoveredNode: SimNode | null,
  dragNode: SimNode | null,
  width: number,
  height: number,
  cam: Camera,
) {
  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.scale(cam.zoom, cam.zoom);

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));

  const root = document.documentElement;
  const accent = getComputedStyle(root).getPropertyValue("--prism-accent").trim() || "#7c3aed";
  const fg = getComputedStyle(root).getPropertyValue("--prism-fg").trim() || "#e0e0e0";
  const muted = getComputedStyle(root).getPropertyValue("--prism-muted").trim() || "#888";
  const border = getComputedStyle(root).getPropertyValue("--prism-border").trim() || "#333";

  // Draw edges
  ctx.strokeStyle = border;
  ctx.lineWidth = 1 / cam.zoom;
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
    const isDragged = dragNode?.id === node.id;

    ctx.beginPath();
    ctx.arc(node.x, node.y, isHovered || isDragged ? nodeRadius + 2 : nodeRadius, 0, Math.PI * 2);

    if (isCurrent) {
      ctx.fillStyle = accent;
    } else if (isHovered || isDragged) {
      ctx.fillStyle = accent;
      ctx.globalAlpha = 0.7;
    } else {
      ctx.fillStyle = muted;
    }
    ctx.fill();
    ctx.globalAlpha = 1;

    // Label - scale font so it stays readable
    const fontSize = Math.max(11 / cam.zoom, 8);
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillStyle = isCurrent ? accent : fg;
    ctx.globalAlpha = isCurrent || isHovered ? 1 : 0.7;
    ctx.fillText(node.label, node.x, node.y + nodeRadius + fontSize + 2);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

export function LinkGraph({ currentPath, onSelect, onClose }: LinkGraphProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<SimNode[]>([]);
  const edgesRef = useRef<GraphEdge[]>([]);
  const hoveredRef = useRef<SimNode | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });
  const camRef = useRef<Camera>({ x: 0, y: 0, zoom: 1 });
  const dragRef = useRef<{ node: SimNode; offsetX: number; offsetY: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; camX: number; camY: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);

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
      dragRef.current?.node ?? null,
      sizeRef.current.width,
      sizeRef.current.height,
      camRef.current,
    );
  }, [currentPath]);

  const centerGraph = useCallback(() => {
    const nodes = nodesRef.current;
    if (nodes.length === 0) return;
    const { width, height } = sizeRef.current;

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
    const zoom = Math.min((width - padding * 2) / graphW, (height - padding * 2) / graphH, 2);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    camRef.current = {
      x: width / 2 - cx * zoom,
      y: height / 2 - cy * zoom,
      zoom,
    };
    setZoomLevel(Math.round(zoom * 100));
    redraw();
  }, [redraw]);

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
      centerGraph();
    }).catch(console.error);

    const ro = new ResizeObserver(() => {
      resize();
      centerGraph();
    });
    ro.observe(parent);

    return () => ro.disconnect();
  }, [centerGraph]);

  // Zoom with scroll wheel
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const cam = camRef.current;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newZoom = Math.min(Math.max(cam.zoom * zoomFactor, 0.1), 10);

      // Zoom toward cursor position
      cam.x = mx - (mx - cam.x) * (newZoom / cam.zoom);
      cam.y = my - (my - cam.y) * (newZoom / cam.zoom);
      cam.zoom = newZoom;
      setZoomLevel(Math.round(newZoom * 100));
      redraw();
    };

    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [redraw]);

  const findNodeAt = useCallback((sx: number, sy: number): SimNode | null => {
    const { x, y } = screenToWorld(sx, sy, camRef.current);
    const hitRadius = 12 / camRef.current.zoom;
    for (const node of nodesRef.current) {
      const dx = node.x - x;
      const dy = node.y - y;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return node;
      }
    }
    return null;
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const node = findNodeAt(sx, sy);

    if (node) {
      const world = screenToWorld(sx, sy, camRef.current);
      dragRef.current = { node, offsetX: node.x - world.x, offsetY: node.y - world.y };
      canvas.style.cursor = "grabbing";
    } else {
      panRef.current = { startX: e.clientX, startY: e.clientY, camX: camRef.current.x, camY: camRef.current.y };
      canvas.style.cursor = "grabbing";
    }
  }, [findNodeAt]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;

    if (dragRef.current) {
      const world = screenToWorld(sx, sy, camRef.current);
      dragRef.current.node.x = world.x + dragRef.current.offsetX;
      dragRef.current.node.y = world.y + dragRef.current.offsetY;
      redraw();
      return;
    }

    if (panRef.current) {
      camRef.current.x = panRef.current.camX + (e.clientX - panRef.current.startX);
      camRef.current.y = panRef.current.camY + (e.clientY - panRef.current.startY);
      redraw();
      return;
    }

    const node = findNodeAt(sx, sy);
    if (node !== hoveredRef.current) {
      hoveredRef.current = node;
      canvas.style.cursor = node ? "pointer" : "grab";
      redraw();
    }
  }, [findNodeAt, redraw]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (dragRef.current) {
      // If barely moved, treat as click
      const rect = canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const world = screenToWorld(sx, sy, camRef.current);
      const dx = world.x + dragRef.current.offsetX - dragRef.current.node.x;
      const dy = world.y + dragRef.current.offsetY - dragRef.current.node.y;
      if (dx * dx + dy * dy < 4) {
        onSelect(dragRef.current.node.path);
        onClose();
      }
      dragRef.current = null;
      canvas.style.cursor = "grab";
      redraw();
      return;
    }

    panRef.current = null;
    canvas.style.cursor = "grab";
  }, [onSelect, onClose, redraw]);

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
          <div className="flex items-center gap-4" style={{ fontSize: "11px", color: "var(--prism-muted)" }}>
            <span>{zoomLevel}%</span>
            <button
              onClick={(e) => { e.stopPropagation(); centerGraph(); }}
              className="px-2 py-0.5 rounded text-xs"
              style={{ border: "1px solid var(--prism-border)", color: "var(--prism-fg)" }}
            >
              Fit
            </button>
            <span>Scroll to zoom | Drag to pan | Drag nodes to move</span>
          </div>
        </div>
        <div className="relative" style={{ height: "calc(100% - 37px)", cursor: "grab" }}>
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { panRef.current = null; dragRef.current = null; }}
          />
        </div>
      </div>
    </div>
  );
}
