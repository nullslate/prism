import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkWikiLinks from "@/lib/remark-wiki-links";
import rehypeHighlight from "rehype-highlight";
import rehypeSourceLines from "@/lib/rehype-source-lines";
import type { Components } from "react-markdown";
import { commands } from "@/lib/tauri";

function isVaultPath(src: string): boolean {
  if (!src) return false;
  if (src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:")) return false;
  return true;
}

function VaultImage({ src, alt, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src || !isVaultPath(src)) return;
    let cancelled = false;
    commands.getImage(src).then((url) => {
      if (!cancelled) setDataUrl(url);
    }).catch(() => {
      if (!cancelled) setError(true);
    });
    return () => { cancelled = true; };
  }, [src]);

  if (!src || !isVaultPath(src)) {
    return <img src={src} alt={alt} className="max-w-full rounded my-2" {...props} />;
  }

  if (error) {
    return (
      <span className="inline-block px-2 py-1 text-xs rounded" style={{ background: "var(--prism-code-bg)", color: "var(--prism-muted)" }}>
        Image not found: {src}
      </span>
    );
  }

  if (!dataUrl) {
    return (
      <span className="inline-block px-2 py-1 text-xs" style={{ color: "var(--prism-muted)" }}>
        Loading image...
      </span>
    );
  }

  return <img src={dataUrl} alt={alt} className="max-w-full rounded my-2" {...props} />;
}

function TransclusionPreview({ target }: { target: string }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [visible, setVisible] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Strip heading anchor if present
      const filePart = target.split("#")[0];
      const resolved = await commands.resolveWikiLink(filePart);
      if (!resolved) { setLoading(false); return; }
      const content = await commands.readFile(resolved);
      // Truncate to first ~20 lines for preview
      const lines = content.split("\n");
      const truncated = lines.slice(0, 20).join("\n");
      setPreview(truncated + (lines.length > 20 ? "\n..." : ""));
    } catch {
      setPreview(null);
    }
    setLoading(false);
  }, [target]);

  const handleMouseEnter = useCallback(() => {
    timerRef.current = setTimeout(() => {
      setVisible(true);
      load();
    }, 300);
  }, [load]);

  const handleMouseLeave = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setVisible(false);
    setPreview(null);
  }, []);

  return { handleMouseEnter, handleMouseLeave, visible, preview, loading };
}

function WikiLink({ target, children, onNavigate }: {
  target: string;
  children: React.ReactNode;
  onNavigate?: (target: string) => void;
}) {
  const { handleMouseEnter, handleMouseLeave, visible, preview, loading } =
    TransclusionPreview({ target });

  return (
    <span className="relative inline-block" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <a
        href="#"
        className="border-b border-dotted cursor-pointer"
        style={{ color: "var(--prism-heading)", borderColor: "var(--prism-heading)" }}
        onClick={(e) => {
          e.preventDefault();
          onNavigate?.(target);
        }}
      >
        {children}
      </a>
      {visible && (
        <div
          className="absolute z-50 left-0 top-full mt-1 p-3 rounded shadow-lg text-sm overflow-y-auto"
          style={{
            background: "var(--prism-sidebar-bg)",
            border: "1px solid var(--prism-border)",
            color: "var(--prism-fg)",
            maxWidth: "400px",
            maxHeight: "300px",
            minWidth: "200px",
            fontFamily: "var(--font-mono)",
            fontSize: "12px",
            lineHeight: "1.5",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          {loading && <span style={{ color: "var(--prism-muted)" }}>Loading...</span>}
          {!loading && preview && preview}
          {!loading && !preview && <span style={{ color: "var(--prism-muted)" }}>Not found</span>}
        </div>
      )}
    </span>
  );
}

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
        return <WikiLink target={target} onNavigate={onNavigate} {...props}>{children}</WikiLink>;
      }
      return <a href={href} className="underline" style={{ color: "var(--prism-accent)" }} {...props}>{children}</a>;
    },
    ul: ({ children, ...props }) => (
      <ul className="list-disc pl-6 mb-3" {...props}>{children}</ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="list-decimal pl-6 mb-3" {...props}>{children}</ol>
    ),
    li: ({ children, className, ...props }) => {
      const isTodo = className === "task-list-item";
      return (
        <li className={`mb-1 ${isTodo ? "list-none -ml-6 flex items-start gap-2" : ""}`} {...props}>
          {children}
        </li>
      );
    },
    input: ({ type, checked, ...props }) => {
      if (type === "checkbox") {
        return (
          <span
            className="inline-block w-4 h-4 mt-0.5 rounded border flex-shrink-0 text-center leading-4 text-xs select-none"
            style={{
              borderColor: checked ? "var(--prism-accent)" : "var(--prism-muted)",
              background: checked ? "var(--prism-accent)" : "transparent",
              color: checked ? "var(--prism-bg)" : "transparent",
            }}
          >
            {checked ? "\u2713" : ""}
          </span>
        );
      }
      return <input type={type} checked={checked} {...props} />;
    },
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
    img: ({ src, alt, ...props }) => (
      <VaultImage src={src} alt={alt} {...props} />
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
