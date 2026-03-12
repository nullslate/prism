import { createContext, useContext } from "react";
import type { PluginOpts } from "../types";

export const PluginOptsContext = createContext<PluginOpts>({ opts: {} });
export function usePlugin(): PluginOpts {
  return useContext(PluginOptsContext);
}
