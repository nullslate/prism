import { useCallback, useRef } from "react";
import type { ReaderState, ReaderAction } from "@/lib/reader-state";

export type { VimMode } from "@/lib/reader-state";

const DEFAULT_LINE_HEIGHT = 27; // 16px * 1.7

export function useVimMode(
  readerRef: React.RefObject<HTMLDivElement | null>,
  dispatch: React.Dispatch<ReaderAction>,
  state: ReaderState,
) {
  const lineHeightRef = useRef(DEFAULT_LINE_HEIGHT);
  // Ref-mirror for cursorY so moveCursor callback stays stable
  const cursorYRef = useRef(state.cursorY);
  cursorYRef.current = state.cursorY;

  const computeLineHeight = useCallback((): number => {
    const reader = readerRef.current;
    if (!reader) return DEFAULT_LINE_HEIGHT;
    const el = reader.querySelector("p, li, pre code");
    if (el) {
      const lh = parseFloat(getComputedStyle(el).lineHeight);
      if (!isNaN(lh) && lh > 0) {
        lineHeightRef.current = lh;
        return lh;
      }
    }
    return DEFAULT_LINE_HEIGHT;
  }, [readerRef]);

  const getFirstVisibleY = useCallback((): number => {
    const reader = readerRef.current;
    if (!reader) return 0;
    const lh = computeLineHeight();
    return Math.round(reader.scrollTop / lh) * lh;
  }, [readerRef, computeLineHeight]);

  const enterInsert = useCallback(() => {
    const y = getFirstVisibleY();
    dispatch({ type: "SET_VIM_MODE", mode: "insert", cursorY: y });
  }, [getFirstVisibleY, dispatch]);

  const enterVisual = useCallback(() => {
    const y = state.vimMode === "insert" ? state.cursorY : getFirstVisibleY();
    dispatch({ type: "SET_VIM_MODE", mode: "visual", cursorY: y, selectionStartY: y });
  }, [getFirstVisibleY, dispatch, state.vimMode, state.cursorY]);

  const enterVisualLine = useCallback(() => {
    const y = state.vimMode === "insert" ? state.cursorY : getFirstVisibleY();
    dispatch({ type: "SET_VIM_MODE", mode: "visual-line", cursorY: y, selectionStartY: y });
  }, [getFirstVisibleY, dispatch, state.vimMode, state.cursorY]);

  const exitMode = useCallback(() => {
    dispatch({ type: "EXIT_VIM_MODE" });
    window.getSelection()?.removeAllRanges();
  }, [dispatch]);

  const moveCursor = useCallback(
    (direction: "up" | "down") => {
      const reader = readerRef.current;
      if (!reader) return;
      const lh = lineHeightRef.current;
      const maxY = Math.max(0, reader.scrollHeight - lh);
      const currentY = cursorYRef.current;

      const newY =
        direction === "down"
          ? Math.min(currentY + lh, maxY)
          : Math.max(currentY - lh, 0);

      // Auto-scroll to keep cursor visible
      if (newY < reader.scrollTop) {
        reader.scrollTop = newY;
      } else if (newY + lh > reader.scrollTop + reader.clientHeight) {
        reader.scrollTop = newY + lh - reader.clientHeight;
      }

      dispatch({ type: "MOVE_CURSOR", cursorY: newY });
    },
    [readerRef, dispatch],
  );

  const yankSelection = useCallback(() => {
    const reader = readerRef.current;
    if (!reader) return;

    const startY = Math.min(state.selectionStartY, state.cursorY);
    const endY = Math.max(state.selectionStartY, state.cursorY);
    const lh = lineHeightRef.current;
    const readerRect = reader.getBoundingClientRect();

    const blocks = reader.querySelectorAll("[data-source-line]");
    const texts: string[] = [];

    for (const block of blocks) {
      const el = block as HTMLElement;
      const rect = el.getBoundingClientRect();
      const elY = rect.top - readerRect.top + reader.scrollTop;
      if (elY + rect.height >= startY && elY <= endY + lh) {
        texts.push(el.textContent?.trim() || "");
      }
    }

    if (texts.length > 0) {
      navigator.clipboard.writeText(texts.join("\n"));
    }
    exitMode();
  }, [state.selectionStartY, state.cursorY, readerRef, exitMode]);

  const jumpToTop = useCallback(() => {
    dispatch({ type: "JUMP", cursorY: 0 });
    readerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [readerRef, dispatch]);

  const jumpToBottom = useCallback(() => {
    const reader = readerRef.current;
    if (!reader) return;
    const lh = lineHeightRef.current;
    const maxY = Math.max(0, reader.scrollHeight - lh);
    dispatch({ type: "JUMP", cursorY: maxY });
    reader.scrollTo({ top: reader.scrollHeight, behavior: "smooth" });
  }, [readerRef, dispatch]);

  const getSourceLine = useCallback((): number => {
    const reader = readerRef.current;
    if (!reader) return 1;

    const y = state.vimMode !== "normal" ? state.cursorY : reader.scrollTop;
    const readerRect = reader.getBoundingClientRect();
    const blocks = reader.querySelectorAll("[data-source-line]");

    let closest: HTMLElement | null = null;
    let minDist = Infinity;

    for (const block of blocks) {
      const el = block as HTMLElement;
      const rect = el.getBoundingClientRect();
      const elY = rect.top - readerRect.top + reader.scrollTop;
      const dist = Math.abs(elY - y);
      if (dist < minDist) {
        minDist = dist;
        closest = el;
      }
    }

    if (closest) {
      const line = closest.getAttribute("data-source-line");
      return line ? parseInt(line, 10) : 1;
    }
    return 1;
  }, [readerRef, state.vimMode, state.cursorY]);

  return {
    lineHeight: lineHeightRef.current,
    enterVisual,
    enterVisualLine,
    enterInsert,
    exitMode,
    moveCursor,
    yankSelection,
    jumpToTop,
    jumpToBottom,
    getSourceLine,
  };
}
