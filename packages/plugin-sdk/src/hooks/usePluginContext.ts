import { createContext, useContext } from "react";
import type { PluginContext } from "../types";

export const PluginContextCtx = createContext<PluginContext>({
  currentFile: null,
  theme: {},
  on: () => () => {},
});

export function usePluginContext(): PluginContext {
  return useContext(PluginContextCtx);
}
