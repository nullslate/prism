import { visit } from "unist-util-visit";
import type { Root, Element } from "hast";

const BLOCK_TAGS = new Set(["h1","h2","h3","h4","h5","h6","p","pre","blockquote","li","table","tr","hr","div"]);

export default function rehypeSourceLines() {
  return (tree: Root) => {
    visit(tree, "element", (node: Element) => {
      if (!node.position || !BLOCK_TAGS.has(node.tagName)) return;
      node.properties ??= {};
      node.properties["dataSourceLine"] = node.position.start.line;
    });
  };
}
