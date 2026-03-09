import { memo, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkWikiLinks from "@/lib/remark-wiki-links";
import rehypeHighlight from "rehype-highlight";
import rehypeSourceLines from "@/lib/rehype-source-lines";
import type { Components } from "react-markdown";

const REMARK_PLUGINS = [remarkGfm, remarkFrontmatter, remarkWikiLinks];
const REHYPE_PLUGINS = [rehypeHighlight, rehypeSourceLines];

function buildComponents(onNavigate?: (target: string) => void): Components {
  return {
    h1: ({ children, ...props }) => (
      <h1 className="text-2xl font-bold mb-4 mt-6" style={{ color: "var(--prism-heading)" }} {...props}>{children}</h1>
    ),
    h2: ({ children, ...props }) => (
      <h2 className="text-xl font-bold mb-3 mt-5" style={{ color: "var(--prism-heading)" }} {...props}>{children}</h2>
    ),
    h3: ({ children, ...props }) => (
      <h3 className="text-lg font-semibold mb-2 mt-4" style={{ color: "var(--prism-heading)" }} {...props}>{children}</h3>
    ),
    h4: ({ children, ...props }) => (
      <h4 className="text-base font-semibold mb-2 mt-3" style={{ color: "var(--prism-heading)" }} {...props}>{children}</h4>
    ),
    p: ({ children, ...props }) => (
      <p className="mb-3" {...props}>{children}</p>
    ),
    code: ({ className, children, ...props }) => {
      const isInline = !className;
      if (isInline) {
        return (
          <code
            className="px-1 py-0.5 text-sm rounded"
            style={{ background: "var(--prism-code-bg)", fontFamily: "var(--font-mono)", color: "var(--prism-accent)" }}
            {...props}
          >{children}</code>
        );
      }
      return <code className={className} style={{ fontFamily: "var(--font-mono)" }} {...props}>{children}</code>;
    },
    pre: ({ children, ...props }) => (
      <pre className="p-4 rounded overflow-x-auto my-4 text-sm" style={{ background: "var(--prism-code-bg)", fontFamily: "var(--font-mono)" }} {...props}>
        {children}
      </pre>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote className="border-l-2 pl-4 my-4 italic" style={{ borderColor: "var(--prism-accent)", color: "var(--prism-muted)" }} {...props}>
        {children}
      </blockquote>
    ),
    a: ({ children, href, ...props }) => {
      if (href?.startsWith("wiki:")) {
        const target = href.slice(5);
        return (
          <a
            href="#"
            className="border-b border-dotted cursor-pointer"
            style={{ color: "var(--prism-heading)", borderColor: "var(--prism-heading)" }}
            onClick={(e) => {
              e.preventDefault();
              onNavigate?.(target);
            }}
            {...props}
          >{children}</a>
        );
      }
      return <a href={href} className="underline" style={{ color: "var(--prism-accent)" }} {...props}>{children}</a>;
    },
    ul: ({ children, ...props }) => (
      <ul className="list-disc pl-6 mb-3" {...props}>{children}</ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="list-decimal pl-6 mb-3" {...props}>{children}</ol>
    ),
    li: ({ children, ...props }) => (
      <li className="mb-1" {...props}>{children}</li>
    ),
    hr: (props) => (
      <hr className="my-6 border-0 h-px" style={{ background: "var(--prism-border)" }} {...props} />
    ),
    table: ({ children, ...props }) => (
      <div className="overflow-x-auto my-4">
        <table className="w-full text-sm" style={{ borderColor: "var(--prism-border)" }} {...props}>{children}</table>
      </div>
    ),
    th: ({ children, ...props }) => (
      <th className="text-left px-3 py-1.5 border-b font-semibold" style={{ borderColor: "var(--prism-border)", color: "var(--prism-heading)" }} {...props}>{children}</th>
    ),
    td: ({ children, ...props }) => (
      <td className="px-3 py-1.5 border-b" style={{ borderColor: "var(--prism-border)" }} {...props}>{children}</td>
    ),
  };
}

interface MarkdownViewerProps {
  content: string;
  onNavigate?: (target: string) => void;
}

function parseFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;
  const meta: Record<string, string> = {};
  const lines = match[1].split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) { i++; continue; }
    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();
    // Handle empty arrays
    if (value === "[]") { i++; continue; }
    // Handle multi-line arrays (indented with -)
    if (value === "" && i + 1 < lines.length && lines[i + 1].match(/^\s+-\s/)) {
      const items: string[] = [];
      i++;
      while (i < lines.length && lines[i].match(/^\s+-\s/)) {
        items.push(lines[i].replace(/^\s+-\s*/, "").trim());
        i++;
      }
      if (items.length > 0) meta[key] = items.join(", ");
      continue;
    }
    if (value) meta[key] = value;
    i++;
  }
  return Object.keys(meta).length > 0 ? meta : null;
}

function FrontmatterBar({ meta }: { meta: Record<string, string> }) {
  return (
    <div
      className="flex flex-wrap gap-x-4 gap-y-1 mb-4 pb-3 text-sm border-b"
      style={{
        fontFamily: "var(--font-mono)",
        borderColor: "var(--prism-border)",
        color: "var(--prism-muted)",
      }}
    >
      {Object.entries(meta).map(([key, value]) => (
        <span key={key}>
          <span style={{ color: "var(--prism-accent)" }}>{key}</span>{" "}
          {value}
        </span>
      ))}
    </div>
  );
}

export const MarkdownViewer = memo(function MarkdownViewer({ content, onNavigate }: MarkdownViewerProps) {
  const frontmatter = useMemo(() => parseFrontmatter(content), [content]);
  const components = useMemo(() => buildComponents(onNavigate), [onNavigate]);

  return (
    <div style={{ fontFamily: "var(--font-sans)", fontSize: "16px", lineHeight: "1.7", color: "var(--prism-fg)" }}>
      {frontmatter && <FrontmatterBar meta={frontmatter} />}
      <ReactMarkdown
        remarkPlugins={REMARK_PLUGINS}
        rehypePlugins={REHYPE_PLUGINS}
        components={components}
        urlTransform={(url) => url}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});
