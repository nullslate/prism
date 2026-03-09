import { memo, useState } from "react";
import type { FileNode } from "@/lib/types";

interface FileTreeProps {
  nodes: FileNode[];
  currentPath: string | null;
  onSelect: (path: string) => void;
  onTrash?: (path: string) => void;
  depth?: number;
}

export function FileTree({ nodes, currentPath, onSelect, onTrash, depth = 0 }: FileTreeProps) {
  return (
    <ul className="list-none m-0 p-0">
      {nodes.map((node) => (
        <FileTreeNode
          key={node.path}
          node={node}
          currentPath={currentPath}
          onSelect={onSelect}
          onTrash={onTrash}
          depth={depth}
        />
      ))}
    </ul>
  );
}

const FileTreeNode = memo(function FileTreeNode({
  node, currentPath, onSelect, onTrash, depth,
}: {
  node: FileNode;
  currentPath: string | null;
  onSelect: (path: string) => void;
  onTrash?: (path: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = useState(depth < 1);
  const isActive = currentPath === node.path;
  const indent = depth * 12;

  if (node.is_dir) {
    return (
      <li>
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left flex items-center gap-1.5 py-1 px-3 text-sm hover:opacity-80"
          style={{ paddingLeft: `${indent + 8}px`, color: "var(--prism-muted)", fontFamily: "var(--font-mono)" }}
        >
          <span className="w-3 text-center">{expanded ? "\u25BE" : "\u25B8"}</span>
          {node.name}/
        </button>
        {expanded && (
          <FileTree nodes={node.children} currentPath={currentPath} onSelect={onSelect} onTrash={onTrash} depth={depth + 1} />
        )}
      </li>
    );
  }

  return (
    <li>
      <div
        className="group flex items-center"
        style={{
          background: isActive ? "var(--prism-selection)" : "transparent",
        }}
      >
        <button
          onClick={() => onSelect(node.path)}
          className="flex-1 text-left py-1 px-3 text-sm truncate"
          style={{
            paddingLeft: `${indent + 22}px`,
            fontFamily: "var(--font-mono)",
            color: isActive ? "var(--prism-accent)" : "var(--prism-fg)",
          }}
        >
          {node.name.replace(/\.md$/, "")}
        </button>
        {onTrash && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTrash(node.path);
            }}
            className="opacity-0 group-hover:opacity-60 hover:!opacity-100 px-2 py-1 text-xs shrink-0"
            style={{ color: "var(--prism-muted)", fontFamily: "var(--font-mono)" }}
            title="Move to trash"
          >
            x
          </button>
        )}
      </div>
    </li>
  );
});
