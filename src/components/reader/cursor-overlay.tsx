import { useEffect, useRef } from "react";
import { useReader } from "@/components/reader-provider";

interface CursorOverlayProps {
  lineHeight: number;
}

export function CursorOverlay({ lineHeight }: CursorOverlayProps) {
  const { state, readerRef } = useReader();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);

  // Create persistent DOM elements once on mount
  useEffect(() => {
    const reader = readerRef.current;
    if (!reader) return;

    const overlay = document.createElement("div");
    overlay.style.position = "absolute";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.right = "0";
    overlay.style.pointerEvents = "none";
    overlay.style.zIndex = "5";

    const selection = document.createElement("div");
    selection.style.position = "absolute";
    selection.style.left = "0";
    selection.style.right = "0";
    selection.style.background = "var(--prism-selection)";
    selection.style.display = "none";
    overlay.appendChild(selection);

    const cursor = document.createElement("div");
    cursor.style.position = "absolute";
    cursor.style.left = "0";
    cursor.style.right = "0";
    cursor.style.borderLeft = "2px solid var(--prism-accent)";
    overlay.appendChild(cursor);

    reader.appendChild(overlay);
    overlayRef.current = overlay;
    cursorRef.current = cursor;
    selectionRef.current = selection;

    return () => {
      cancelAnimationFrame(rafRef.current);
      overlay.remove();
      overlayRef.current = null;
      cursorRef.current = null;
      selectionRef.current = null;
    };
  }, [readerRef]);

  // Update positions via RAF — style mutations only
  useEffect(() => {
    rafRef.current = requestAnimationFrame(() => {
      const reader = readerRef.current;
      const overlay = overlayRef.current;
      const cursor = cursorRef.current;
      const selection = selectionRef.current;
      if (!reader || !overlay || !cursor || !selection) return;

      overlay.style.height = `${reader.scrollHeight}px`;

      cursor.style.top = `${state.cursorY}px`;
      cursor.style.height = `${lineHeight}px`;

      if (state.vimMode === "visual" || state.vimMode === "visual-line") {
        const startY = Math.min(state.selectionStartY, state.cursorY);
        const endY = Math.max(state.selectionStartY, state.cursorY);
        selection.style.top = `${startY}px`;
        selection.style.height = `${endY - startY + lineHeight}px`;
        selection.style.display = "block";
      } else {
        selection.style.display = "none";
      }
    });
  }, [state.cursorY, state.selectionStartY, state.vimMode, lineHeight, readerRef]);

  return null;
}
