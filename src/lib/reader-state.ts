export type Overlay = "none" | "file-finder" | "search" | "palette" | "new-file" | "rename" | "tags" | "capture" | "graph" | "vault-search" | "template" | "theme";

export interface ReaderState {
  sidebarVisible: boolean;
  overlay: Overlay;
  editorOpen: boolean;
  keySequence: string;
  saveFlash: boolean;
}

export type ReaderAction =
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "SET_OVERLAY"; overlay: Overlay }
  | { type: "CLOSE_OVERLAY" }
  | { type: "OPEN_EDITOR" }
  | { type: "CLOSE_EDITOR" }
  | { type: "SET_KEY_SEQUENCE"; keySequence: string }
  | { type: "SAVE_FLASH" };

export const initialReaderState: ReaderState = {
  sidebarVisible: false,
  overlay: "none",
  editorOpen: false,
  keySequence: "",
  saveFlash: false,
};

export function readerReducer(state: ReaderState, action: ReaderAction): ReaderState {
  switch (action.type) {
    case "TOGGLE_SIDEBAR":
      return { ...state, sidebarVisible: !state.sidebarVisible };
    case "SET_OVERLAY":
      return { ...state, overlay: action.overlay };
    case "CLOSE_OVERLAY":
      return { ...state, overlay: "none" };
    case "OPEN_EDITOR":
      return { ...state, editorOpen: true, overlay: "none" };
    case "CLOSE_EDITOR":
      return { ...state, editorOpen: false };
    case "SET_KEY_SEQUENCE":
      return { ...state, keySequence: action.keySequence };
    case "SAVE_FLASH":
      return { ...state, saveFlash: !state.saveFlash };
    default:
      return state;
  }
}
