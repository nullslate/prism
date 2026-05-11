import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileNode } from "@/lib/types";
import { commands } from "@/lib/tauri";
import { log } from "@/lib/logger";

function extLabel(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "";
  return name.slice(dot + 1).toLowerCase().slice(0, 4);
}

// Per-kind accent color for the badge — gives the eye a fast signal.
function kindColor(kind: string): string {
  switch (kind) {
    case "image":
      return "var(--prism-syntax-string)"; // greenish
    case "pdf":
      return "var(--prism-syntax-keyword)"; // pinkish/red
    case "canvas":
      return "var(--prism-syntax-function)"; // bluish
    case "text":
      return "var(--prism-syntax-comment)"; // gray
    default:
      return "var(--prism-muted)";
  }
}

interface FileTreeProps {
  nodes: FileNode[];
  currentPath: string | null;
  onSelect: (path: string) => void;
  onTrash?: (path: string) => void;
  onRename?: (oldPath: string, newPath: string) => void;
  onRefresh?: () => void;
  onClose: () => void;
}

interface FlatItem {
  node: FileNode;
  depth: number;
  expanded: boolean;
}

function flattenTree(
  nodes: FileNode[],
  expanded: Set<string>,
  depth: number = 0,
): FlatItem[] {
  const result: FlatItem[] = [];
  for (const node of nodes) {
    const isExpanded = expanded.has(node.path);
    result.push({ node, depth, expanded: isExpanded });
    if (node.is_dir && isExpanded) {
      result.push(...flattenTree(node.children, expanded, depth + 1));
    }
  }
  return result;
}

export const FileTree = memo(function FileTree({
  nodes,
  currentPath,
  onSelect,
  onTrash,
  onRename,
  onRefresh,
  onClose,
}: FileTreeProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);
  const [cursorRect, setCursorRect] = useState<{ top: number; height: number } | null>(null);
  const [pendingTrash, setPendingTrash] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const pendingTrashTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const items = useMemo(
    () => flattenTree(nodes, expandedDirs),
    [nodes, expandedDirs],
  );

  // Clamp cursor when items change
  useEffect(() => {
    if (cursor >= items.length && items.length > 0) {
      setCursor(items.length - 1);
    }
  }, [items.length, cursor]);

  // Scroll active item into view AND measure its real position for the cursor highlight
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current.querySelector<HTMLElement>(`[data-idx="${cursor}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "nearest" });
    setCursorRect({ top: el.offsetTop, height: el.offsetHeight });
  }, [cursor, items.length]);

  // Auto-focus the container on mount so it captures keyboard events
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Focus on rename input
  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus();
      const dotIdx = renameValue.lastIndexOf(".");
      if (dotIdx > 0) {
        renameInputRef.current.setSelectionRange(0, dotIdx);
      } else {
        renameInputRef.current.select();
      }
    }
  }, [renaming, renameValue]);

  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const expandDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  const collapseDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      if (!prev.has(path)) return prev;
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  }, []);

  const handleRenameSubmit = useCallback(async () => {
    if (!renaming || !renameValue.trim()) {
      setRenaming(null);
      return;
    }
    const newPath = renameValue.trim();
    if (newPath === renaming) {
      setRenaming(null);
      return;
    }
    try {
      await commands.renameFile(renaming, newPath);
      onRename?.(renaming, newPath);
      onRefresh?.();
    } catch (e) {
      log.error("Rename failed:", e);
    }
    setRenaming(null);
  }, [renaming, renameValue, onRename, onRefresh]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (items.length === 0) return;

      // Let modifier combos bubble up (Ctrl+B, Ctrl+F, etc.)
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // When renaming, input handles its own keys
      if (renaming) return;

      // Close on Escape or q
      if (e.key === "Escape" || e.key === "q") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
        return;
      }

      const item = items[cursor];
      if (!item) return;

      switch (e.key) {
        case "j":
          e.preventDefault();
          setCursor((c) => Math.min(c + 1, items.length - 1));
          setPendingTrash(null);
          break;
        case "k":
          e.preventDefault();
          setCursor((c) => Math.max(c - 1, 0));
          setPendingTrash(null);
          break;
        case "o":
        case "Enter":
          e.preventDefault();
          if (item.node.is_dir) {
            toggleDir(item.node.path);
          } else if (item.node.kind === "markdown" || item.node.kind === "") {
            onSelect(item.node.path);
          } else {
            commands.openAttachment(item.node.path).catch(log.error);
          }
          break;
        case "l":
          e.preventDefault();
          if (item.node.is_dir) {
            expandDir(item.node.path);
          }
          break;
        case "h":
          e.preventDefault();
          if (item.node.is_dir && item.expanded) {
            collapseDir(item.node.path);
          } else if (item.depth > 0) {
            for (let i = cursor - 1; i >= 0; i--) {
              if (items[i].node.is_dir && items[i].depth < item.depth) {
                setCursor(i);
                break;
              }
            }
          }
          break;
        case " ":
          e.preventDefault();
          if (item.node.is_dir) {
            toggleDir(item.node.path);
          }
          break;
        case "d":
          e.preventDefault();
          if (!item.node.is_dir) {
            if (pendingTrash === item.node.path) {
              if (pendingTrashTimer.current) clearTimeout(pendingTrashTimer.current);
              setPendingTrash(null);
              onTrash?.(item.node.path);
            } else {
              setPendingTrash(item.node.path);
              if (pendingTrashTimer.current) clearTimeout(pendingTrashTimer.current);
              pendingTrashTimer.current = setTimeout(() => setPendingTrash(null), 2000);
            }
          }
          break;
        case "R":
          e.preventDefault();
          if (!item.node.is_dir) {
            setRenaming(item.node.path);
            setRenameValue(item.node.path);
          }
          break;
        case "g":
          e.preventDefault();
          setCursor(0);
          break;
        case "G":
          e.preventDefault();
          setCursor(items.length - 1);
          break;
        default:
          // Don't prevent default — let it bubble
          break;
      }
    },
    [items, cursor, renaming, pendingTrash, toggleDir, expandDir, collapseDir, onSelect, onTrash, onClose],
  );


  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto outline-none"
      style={{ scrollbarWidth: "none" }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <div className="relative">
        {cursorRect && (
          <div
            className="file-tree-cursor"
            style={{ top: `${cursorRect.top}px`, height: `${cursorRect.height}px` }}
          />
        )}
      <ul className="list-none m-0 p-0 relative" style={{ zIndex: 1 }}>
        {items.map((item, idx) => (
          <FileTreeRow
            key={item.node.path}
            item={item}
            idx={idx}
            isCursor={idx === cursor}
            isActive={currentPath === item.node.path}
            isPendingTrash={pendingTrash === item.node.path}
            isRenaming={renaming === item.node.path}
            renameValue={renameValue}
            renameInputRef={renameInputRef}
            onRenameChange={setRenameValue}
            onRenameSubmit={handleRenameSubmit}
            onRenameCancel={() => setRenaming(null)}
            onSelect={onSelect}
            onToggle={toggleDir}
            onSetCursor={setCursor}
            containerRef={containerRef}
          />
        ))}
      </ul>
      </div>
      {pendingTrash && (
        <div
          className="sticky bottom-0 left-0 right-0 px-3 py-1.5 text-xs text-center"
          style={{
            background: "var(--prism-code-bg)",
            color: "var(--prism-accent)",
            fontFamily: "var(--font-mono)",
            borderTop: "1px solid var(--prism-border)",
          }}
        >
          press d again to confirm delete
        </div>
      )}
    </div>
  );
});

const FileTreeRow = memo(function FileTreeRow({
  item,
  idx,
  isCursor: _isCursor,
  isActive,
  isPendingTrash,
  isRenaming,
  renameValue,
  renameInputRef,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  onSelect,
  onToggle,
  onSetCursor,
  containerRef,
}: {
  item: FlatItem;
  idx: number;
  isCursor: boolean;
  isActive: boolean;
  isPendingTrash: boolean;
  isRenaming: boolean;
  renameValue: string;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onRenameChange: (value: string) => void;
  onRenameSubmit: () => void;
  onRenameCancel: () => void;
  onSelect: (path: string) => void;
  onToggle: (path: string) => void;
  onSetCursor: (idx: number) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { node, depth, expanded } = item;
  const indent = depth * 16 + 12;

  const bg = "transparent";
  const isAttachment = !node.is_dir && node.kind !== "markdown" && node.kind !== "";

  const color = isPendingTrash
    ? "var(--prism-syntax-variable)"
    : isActive
      ? "var(--prism-accent)"
      : node.is_dir
        ? "var(--prism-muted)"
        : isAttachment
          ? "var(--prism-muted)"
          : "var(--prism-fg)";

  if (isRenaming) {
    return (
      <li data-idx={idx}>
        <div
          className="file-tree-row px-3"
          style={{ paddingLeft: `${indent}px`, background: bg }}
        >
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onRenameSubmit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onRenameCancel();
              }
              e.stopPropagation();
            }}
            onBlur={() => {
              onRenameCancel();
              // Re-focus container so keyboard nav works
              containerRef.current?.focus();
            }}
            className="w-full bg-transparent text-sm outline-none"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--prism-fg)",
              borderBottom: "1px solid var(--prism-accent)",
            }}
          />
        </div>
      </li>
    );
  }

  return (
    <li data-idx={idx}>
      <div
        onClick={() => {
          onSetCursor(idx);
          if (node.is_dir) {
            onToggle(node.path);
          } else if (isAttachment) {
            commands.openAttachment(node.path).catch(log.error);
          } else {
            onSelect(node.path);
          }
          // Keep focus on container
          containerRef.current?.focus();
        }}
        className="file-tree-row gap-1.5 px-3 text-sm cursor-pointer"
        style={{
          paddingLeft: `${indent}px`,
          fontFamily: "var(--font-mono)",
          color,
          background: bg,
        }}
      >
        {node.is_dir && (
          <span className="w-3 text-center shrink-0">
            {expanded ? "\u25BE" : "\u25B8"}
          </span>
        )}
        {!node.is_dir && (
          isAttachment ? (
            <span
              className="shrink-0 inline-flex items-center justify-center font-bold uppercase"
              style={{
                minWidth: "2.4em",
                fontSize: "9px",
                color: kindColor(node.kind),
                background: "color-mix(in srgb, " + kindColor(node.kind) + " 14%, transparent)",
                border: "1px solid color-mix(in srgb, " + kindColor(node.kind) + " 35%, transparent)",
                borderRadius: "3px",
                padding: "1px 4px",
                lineHeight: 1,
                letterSpacing: "0.05em",
                fontFamily: "var(--font-mono)",
              }}
              aria-hidden
            >
              {extLabel(node.name)}
            </span>
          ) : (
            <span
              className="shrink-0 inline-flex items-center justify-center"
              style={{
                minWidth: "2.4em",
                fontSize: "9px",
                color: "var(--prism-muted)",
                opacity: 0.55,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.05em",
              }}
              aria-hidden
            >
              md
            </span>
          )
        )}
        <span className="truncate">
          {node.is_dir
            ? `${node.name}/`
            : node.kind === "markdown" || node.kind === ""
              ? node.name.replace(/\.md$/, "")
              : node.name}
        </span>
      </div>
    </li>
  );
});
