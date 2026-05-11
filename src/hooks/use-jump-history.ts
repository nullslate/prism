import { useCallback, useRef } from "react";

// Vim-style jump history across files. Push on file open, navigate with back/forward.
// Mirrors how <C-o>/<C-i> behave at the file level rather than within-buffer.

interface JumpHistoryState {
  stack: string[];
  index: number; // points at "current" position in stack
}

export function useJumpHistory() {
  const ref = useRef<JumpHistoryState>({ stack: [], index: -1 });
  const suppressNextPush = useRef(false);

  const push = useCallback((path: string) => {
    if (suppressNextPush.current) {
      suppressNextPush.current = false;
      return;
    }
    const s = ref.current;
    // If we're navigating from the middle, drop forward history.
    s.stack = s.stack.slice(0, s.index + 1);
    if (s.stack[s.stack.length - 1] === path) return; // no-op duplicate
    s.stack.push(path);
    // Cap history at 100 entries
    if (s.stack.length > 100) s.stack = s.stack.slice(-100);
    s.index = s.stack.length - 1;
  }, []);

  const back = useCallback((): string | null => {
    const s = ref.current;
    if (s.index <= 0) return null;
    s.index -= 1;
    suppressNextPush.current = true;
    return s.stack[s.index];
  }, []);

  const forward = useCallback((): string | null => {
    const s = ref.current;
    if (s.index >= s.stack.length - 1) return null;
    s.index += 1;
    suppressNextPush.current = true;
    return s.stack[s.index];
  }, []);

  return { push, back, forward };
}
