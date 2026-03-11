import { useMemo, useCallback } from "react";

interface Heading {
  level: number;
  text: string;
  line: number;
}

interface OutlineProps {
  content: string | null;
  readerRef: React.RefObject<HTMLElement | null>;
}

function parseHeadings(content: string): Heading[] {
  const headings: Heading[] = [];
  let inCodeBlock = false;
  let inFrontmatter = content.startsWith("---\n");
  let pastFrontmatter = !inFrontmatter;

  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (inFrontmatter && i > 0 && line === "---") {
      inFrontmatter = false;
      pastFrontmatter = true;
      continue;
    }
    if (!pastFrontmatter) continue;

    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{1,6})\s+(.+)/);
    if (match) {
      headings.push({
        level: match[1].length,
        text: match[2].replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1"),
        line: i + 1,
      });
    }
  }
  return headings;
}

export function Outline({ content, readerRef }: OutlineProps) {
  const headings = useMemo(() => {
    if (!content) return [];
    return parseHeadings(content);
  }, [content]);

  const scrollToHeading = useCallback(
    (line: number) => {
      const reader = readerRef.current;
      if (!reader) return;
      const el = reader.querySelector<HTMLElement>(`[data-source-line="${line}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    },
    [readerRef],
  );

  if (headings.length === 0) return null;

  return (
    <div className="border-t" style={{ borderColor: "var(--prism-border)" }}>
      <div
        className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest"
        style={{ color: "var(--prism-muted)" }}
      >
        Outline
      </div>
      <ul className="list-none m-0 p-0 pb-2">
        {headings.map((h, i) => (
          <li key={`${h.line}-${i}`}>
            <button
              onClick={() => scrollToHeading(h.line)}
              className="w-full text-left py-0.5 px-3 text-xs truncate hover:opacity-80"
              style={{
                paddingLeft: `${(h.level - 1) * 12 + 12}px`,
                fontFamily: "var(--font-mono)",
                color: h.level <= 2 ? "var(--prism-fg)" : "var(--prism-muted)",
              }}
            >
              {h.text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
