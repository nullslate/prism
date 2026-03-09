import { useCallback, useEffect, useState } from "react";
import { commands, onFileChanged } from "@/lib/tauri";
import type { FileNode } from "@/lib/types";

export function useVault() {
  const [files, setFiles] = useState<FileNode[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const refreshFiles = useCallback(async () => {
    try {
      const tree = await commands.listFiles();
      setFiles(tree);
    } catch (e) {
      console.error("Failed to load files:", e);
    }
  }, []);

  const openFile = useCallback(async (path: string) => {
    setLoading(true);
    setCurrentPath(path);
    try {
      const md = await commands.readFile(path);
      setContent(md);
    } catch (e) {
      console.error("Failed to read file:", e);
      setContent("");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  useEffect(() => {
    const unlisten = onFileChanged((changedPath) => {
      refreshFiles();
      if (currentPath && changedPath.endsWith(currentPath)) {
        commands.readFile(currentPath).then(setContent).catch(console.error);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [currentPath, refreshFiles]);

  const closeFile = useCallback(() => {
    setCurrentPath(null);
    setContent("");
  }, []);

  return { files, currentPath, content, loading, openFile, closeFile, refreshFiles, setContent };
}
