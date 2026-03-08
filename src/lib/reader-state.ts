export type VimMode = "normal" | "visual" | "visual-line" | "insert";
export type Overlay = "none" | "file-finder" | "search" | "palette";

export interface ReaderState {
  sidebarVisible: boolean;
  overlay: Overlay;
  vimMode: VimMode;
  cursorY: number;
  selectionStartY: number;
  keySequence: string;
}

export type ReaderAction =
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "SET_OVERLAY"; overlay: Overlay }
  | { type: "CLOSE_OVERLAY" }
  | { type: "SET_VIM_MODE"; mode: VimMode; cursorY?: number; selectionStartY?: number }
  | { type: "MOVE_CURSOR"; cursorY: number }
  | { type: "EXIT_VIM_MODE" }
  | { type: "SET_KEY_SEQUENCE"; keySequence: string }
  | { type: "JUMP"; cursorY: number };

export const initialReaderState: ReaderState = {
  sidebarVisible: true,
  overlay: "none",
  vimMode: "normal",
  cursorY: 0,
  selectionStartY: 0,
  keySequence: "",
};

export function readerReducer(state: ReaderState, action: ReaderAction): ReaderState {
  switch (action.type) {
    case "TOGGLE_SIDEBAR":
      return { ...state, sidebarVisible: !state.sidebarVisible };
    case "SET_OVERLAY":
      return { ...state, overlay: action.overlay };
    case "CLOSE_OVERLAY":
      return {
        ...state,
        overlay: "none",
        vimMode: state.vimMode !== "normal" ? "normal" : state.vimMode,
      };
    case "SET_VIM_MODE":
      return {
        ...state,
        vimMode: action.mode,
        cursorY: action.cursorY ?? state.cursorY,
        selectionStartY: action.selectionStartY ?? state.selectionStartY,
      };
    case "MOVE_CURSOR":
      return { ...state, cursorY: action.cursorY };
    case "EXIT_VIM_MODE":
      return { ...state, vimMode: "normal" };
    case "SET_KEY_SEQUENCE":
      return { ...state, keySequence: action.keySequence };
    case "JUMP":
      return { ...state, cursorY: action.cursorY };
    default:
      return state;
  }
}
