import { useCallback, useEffect, useRef } from "react";
import type { ReaderAction } from "@/lib/reader-state";

export type ShortcutMaps = Record<string, Record<string, () => void>>;

export function useShortcuts(
  maps: ShortcutMaps,
  currentMode: string,
  dispatch: React.Dispatch<ReaderAction>,
) {
  const mapsRef = useRef(maps);
  mapsRef.current = maps;
  const modeRef = useRef(currentMode);
  modeRef.current = currentMode;

  const sequenceRef = useRef("");
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const setKeySequence = useCallback(
    (seq: string) => dispatch({ type: "SET_KEY_SEQUENCE", keySequence: seq }),
    [dispatch],
  );

  const isEditorFocused = useCallback(() => {
    const el = document.activeElement;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return true;
    if (el instanceof HTMLElement && el.closest(".cm-editor")) return true;
    return false;
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const maps = mapsRef.current;
      const mode = modeRef.current;

      // Let CodeMirror and inputs handle all their own keys
      if (isEditorFocused()) return;

      if (e.key === "Escape") {
        const handler = maps.global?.escape ?? maps[mode]?.escape;
        if (handler) {
          e.preventDefault();
          handler();
        }
        sequenceRef.current = "";
        setKeySequence("");
        return;
      }

      const parts: string[] = [];
      if (e.ctrlKey || e.metaKey) parts.push("ctrl");
      if (e.altKey) parts.push("alt");

      const key = e.key.length === 1 ? e.key : e.key.toLowerCase();
      if (e.shiftKey && e.key.length === 1) {
        parts.push(e.key); // already uppercase from shift
      } else {
        parts.push(key.toLowerCase());
      }
      const keyStr = parts.join("+");

      // Check modifier shortcuts in global map first, then mode map
      if (e.ctrlKey || e.metaKey || e.altKey) {
        const handler = maps.global?.[keyStr] ?? maps[mode]?.[keyStr];
        if (handler) {
          e.preventDefault();
          handler();
          sequenceRef.current = "";
          setKeySequence("");
          return;
        }
      }

      // Multi-key sequence (no modifiers)
      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        clearTimeout(timeoutRef.current);
        const pressedKey =
          e.shiftKey && e.key.length === 1 ? e.key : key.toLowerCase();
        const seq = sequenceRef.current
          ? `${sequenceRef.current} ${pressedKey}`
          : pressedKey;
        sequenceRef.current = seq;
        setKeySequence(seq);

        // Check sequence match in mode map, then global
        const seqHandler = maps[mode]?.[seq] ?? maps.global?.[seq];
        if (seqHandler) {
          e.preventDefault();
          seqHandler();
          sequenceRef.current = "";
          setKeySequence("");
          return;
        }

        // Check single-key match (handles e.g. G after a partial g sequence)
        const singleHandler = maps[mode]?.[pressedKey] ?? maps.global?.[pressedKey];
        if (singleHandler) {
          e.preventDefault();
          singleHandler();
          sequenceRef.current = "";
          setKeySequence("");
          return;
        }

        timeoutRef.current = setTimeout(() => {
          sequenceRef.current = "";
          setKeySequence("");
        }, 500);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditorFocused, setKeySequence]);
}
