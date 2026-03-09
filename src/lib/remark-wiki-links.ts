import type { Root, Text, Link } from "mdast";
import type { Plugin } from "unified";
import { visit } from "unist-util-visit";

const WIKI_LINK_RE = /\[\[([^\]]+)\]\]/g;

const remarkWikiLinks: Plugin<[], Root> = () => {
  return (tree) => {
    visit(tree, "text", (node: Text, index, parent) => {
      if (!parent || index === undefined) return;
      const { value } = node;
      if (!value.includes("[[")) return;

      const children: (Text | Link)[] = [];
      let lastIndex = 0;
      let match: RegExpExecArray | null;

      WIKI_LINK_RE.lastIndex = 0;
      while ((match = WIKI_LINK_RE.exec(value)) !== null) {
        const before = value.slice(lastIndex, match.index);
        if (before) {
          children.push({ type: "text", value: before });
        }
        const raw = match[1];
        const pipeIdx = raw.indexOf("|");
        const target = pipeIdx >= 0 ? raw.slice(0, pipeIdx) : raw;
        const display = pipeIdx >= 0 ? raw.slice(pipeIdx + 1) : raw;
        children.push({
          type: "link",
          url: `wiki:${target}`,
          children: [{ type: "text", value: display }],
        });
        lastIndex = match.index + match[0].length;
      }

      const after = value.slice(lastIndex);
      if (after) {
        children.push({ type: "text", value: after });
      }

      if (children.length > 0) {
        parent.children.splice(index, 1, ...children);
      }
    });
  };
};

export default remarkWikiLinks;
