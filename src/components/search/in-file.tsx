import { useCallback, useEffect, useRef, useState } from "react";
import { useReader } from "@/components/reader-provider";

interface InFileSearchProps {
  onClose: () => void;
}

export function InFileSearch({ onClose }: InFileSearchProps) {
  const { readerRef } = useReader();
  const [query, setQuery] = useState("");
  const [matchCount, setMatchCount] = useState(0);
  const [currentMatch, setCurrentMatch] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const getOverlay = useCallback(() => {
    const reader = readerRef.current;
    if (!reader) return null;

    if (!overlayRef.current) {
      const overlay = document.createElement("div");
      overlay.style.position = "absolute";
      overlay.style.inset = "0";
      overlay.style.pointerEvents = "none";
      overlay.style.zIndex = "10";
      reader.appendChild(overlay);
      overlayRef.current = overlay;
    }
    return overlayRef.current;
  }, [readerRef]);

  const clearOverlay = useCallback(() => {
    const overlay = overlayRef.current;
    if (overlay) {
      while (overlay.firstChild) {
        overlay.removeChild(overlay.firstChild);
      }
    }
    setMatchCount(0);
  }, []);

  const highlightMatches = useCallback(
    (searchQuery: string) => {
      clearOverlay();
      const reader = readerRef.current;
      if (!searchQuery || !reader) return;

      const overlay = getOverlay();
      if (!overlay) return;

      const lowerQuery = searchQuery.toLowerCase();
      const readerRect = reader.getBoundingClientRect();
      const scrollTop = reader.scrollTop;
      const scrollLeft = reader.scrollLeft;

      const walker = document.createTreeWalker(reader, NodeFilter.SHOW_TEXT);
      const matchRects: { rect: DOMRect; index: number }[] = [];
      let matchIndex = 0;

      let node: Node | null;
      while ((node = walker.nextNode())) {
        if (overlayRef.current?.contains(node)) continue;

        const text = node.textContent || "";
        const lowerText = text.toLowerCase();
        let idx = lowerText.indexOf(lowerQuery);

        while (idx !== -1) {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + searchQuery.length);

          const rects = range.getClientRects();
          for (let i = 0; i < rects.length; i++) {
            matchRects.push({ rect: rects[i], index: matchIndex });
          }
          matchIndex++;

          idx = lowerText.indexOf(lowerQuery, idx + searchQuery.length);
        }
      }

      requestAnimationFrame(() => {
        for (const { rect, index } of matchRects) {
          const highlight = document.createElement("div");
          highlight.style.position = "absolute";
          highlight.style.left = `${rect.left - readerRect.left + scrollLeft}px`;
          highlight.style.top = `${rect.top - readerRect.top + scrollTop}px`;
          highlight.style.width = `${rect.width}px`;
          highlight.style.height = `${rect.height}px`;
          highlight.style.borderRadius = "2px";
          highlight.dataset.matchIndex = String(index);
          highlight.style.background = "var(--prism-selection)";
          overlay.appendChild(highlight);
        }

        if (matchIndex > 0) {
          overlay
            .querySelectorAll<HTMLDivElement>('div[data-match-index="0"]')
            .forEach((h) => {
              h.style.background = "var(--prism-accent)";
              h.style.opacity = "0.6";
            });
        }
      });

      setMatchCount(matchIndex);
      if (matchIndex > 0) setCurrentMatch(0);
    },
    [readerRef, clearOverlay, getOverlay],
  );

  const goToMatch = useCallback(
    (index: number) => {
      const overlay = overlayRef.current;
      if (!overlay || matchCount === 0) return;

      const wrapped = ((index % matchCount) + matchCount) % matchCount;

      requestAnimationFrame(() => {
        overlay.querySelectorAll<HTMLDivElement>("div[data-match-index]").forEach((h) => {
          h.style.background = "var(--prism-selection)";
          h.style.opacity = "1";
        });

        const current = overlay.querySelectorAll<HTMLDivElement>(
          `div[data-match-index="${wrapped}"]`,
        );
        current.forEach((h) => {
          h.style.background = "var(--prism-accent)";
          h.style.opacity = "0.6";
        });

        if (current.length > 0) {
          const reader = readerRef.current;
          if (reader) {
            const top = parseFloat(current[0].style.top);
            reader.scrollTo({
              top: top - reader.clientHeight / 2,
              behavior: "smooth",
            });
          }
        }
      });

      setCurrentMatch(wrapped);
    },
    [matchCount, readerRef],
  );

  // Debounced highlight (80ms)
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      highlightMatches(query);
    }, 80);
    return () => clearTimeout(debounceRef.current);
  }, [query, highlightMatches]);

  useEffect(() => {
    return () => {
      if (overlayRef.current) {
        overlayRef.current.remove();
        overlayRef.current = null;
      }
    };
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          goToMatch(currentMatch - 1);
        } else {
          goToMatch(currentMatch + 1);
        }
      }
    },
    [onClose, goToMatch, currentMatch],
  );

  return (
    <div
      className="flex items-center gap-2 h-8 px-3 border-t text-sm shrink-0"
      style={{
        borderColor: "var(--prism-border)",
        background: "var(--prism-sidebar-bg)",
        fontFamily: "var(--font-mono)",
      }}
    >
      <span style={{ color: "var(--prism-muted)" }}>/</span>
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        className="flex-1 bg-transparent outline-none text-sm"
        style={{
          color: "var(--prism-fg)",
          fontFamily: "var(--font-mono)",
        }}
        placeholder="Search..."
      />
      {matchCount > 0 && (
        <span style={{ color: "var(--prism-muted)" }}>
          {currentMatch + 1}/{matchCount}
        </span>
      )}
    </div>
  );
}
