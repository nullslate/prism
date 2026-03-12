import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FileNode } from "@/lib/types";
import { commands } from "@/lib/tauri";

interface FileTreeProps {
  nodes: FileNode[];
  currentPath: string | null;
  onSelect: (path: string) => void;
  onTrash?: (path: string) => void;
  onRename?: (oldPath: string, newPath: string) => void;
  onRefresh?: () => void;
  active: boolean;
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
  active,
}: FileTreeProps) {
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState(0);
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

  // Scroll active item into view
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-idx="${cursor}"]`);
    if (el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }, [cursor]);

  // Focus on rename input
  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus();
      // Select just the filename without extension
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
      console.error("Rename failed:", e);
    }
    setRenaming(null);
  }, [renaming, renameValue, onRename, onRefresh]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!active || items.length === 0) return;

      // When renaming, only handle escape and enter
      if (renaming) {
        if (e.key === "Escape") {
          e.preventDefault();
          setRenaming(null);
        }
        // Enter is handled by the input's onKeyDown
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
          } else {
            onSelect(item.node.path);
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
            // Jump to parent dir
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
          // gg to go to top — handled by sequence in use-shortcuts, but we handle it here directly
          e.preventDefault();
          setCursor(0);
          break;
        case "G":
          e.preventDefault();
          setCursor(items.length - 1);
          break;
      }
    },
    [active, items, cursor, renaming, pendingTrash, toggleDir, expandDir, collapseDir, onSelect, onTrash],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Sync cursor to current path when it changes externally
  useEffect(() => {
    if (!currentPath) return;
    const idx = items.findIndex((item) => item.node.path === currentPath);
    if (idx >= 0) setCursor(idx);
  }, [currentPath, items]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
      style={{
        scrollbarWidth: "none",
      }}
    >
      <ul className="list-none m-0 p-0">
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
          />
        ))}
      </ul>
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
  isCursor,
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
}) {
  const { node, depth, expanded } = item;
  const indent = depth * 16 + 12;

  const bg = isCursor
    ? "var(--prism-selection)"
    : "transparent";

  const color = isPendingTrash
    ? "var(--prism-syntax-variable)"
    : isActive
      ? "var(--prism-accent)"
      : node.is_dir
        ? "var(--prism-muted)"
        : "var(--prism-fg)";

  if (isRenaming) {
    return (
      <li data-idx={idx}>
        <div
          className="flex items-center py-1 px-3"
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
            }}
            onBlur={onRenameCancel}
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
      <button
        onClick={() => {
          onSetCursor(idx);
          if (node.is_dir) {
            onToggle(node.path);
          } else {
            onSelect(node.path);
          }
        }}
        className="w-full text-left flex items-center gap-1.5 py-1 px-3 text-sm"
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
        {!node.is_dir && <span className="w-3 shrink-0" />}
        <span className="truncate">
          {node.is_dir ? `${node.name}/` : node.name.replace(/\.md$/, "")}
        </span>
      </button>
    </li>
  );
});
