import { createContext, useContext, useReducer, useRef } from "react";
import {
  readerReducer,
  initialReaderState,
  type ReaderState,
  type ReaderAction,
} from "@/lib/reader-state";

interface ReaderContextValue {
  state: ReaderState;
  dispatch: React.Dispatch<ReaderAction>;
  readerRef: React.RefObject<HTMLDivElement | null>;
}

const ReaderContext = createContext<ReaderContextValue | null>(null);

export function ReaderProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(readerReducer, initialReaderState);
  const readerRef = useRef<HTMLDivElement>(null);

  return (
    <ReaderContext value={{ state, dispatch, readerRef }}>
      {children}
    </ReaderContext>
  );
}

export function useReader(): ReaderContextValue {
  const ctx = useContext(ReaderContext);
  if (!ctx) throw new Error("useReader must be used within ReaderProvider");
  return ctx;
}
