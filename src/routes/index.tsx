import { createFileRoute } from "@tanstack/react-router";
import { useVault } from "@/hooks/use-vault";
import { useShortcuts, type ShortcutMaps } from "@/hooks/use-shortcuts";
import { useVimMode } from "@/hooks/use-vim-mode";
import { usePrism } from "@/components/prism-provider";
import { ReaderProvider, useReader } from "@/components/reader-provider";
import { StatusBar } from "@/components/status-bar";
import { FileTree } from "@/components/sidebar/file-tree";
import { Favorites } from "@/components/sidebar/favorites";
import { MarkdownViewer } from "@/components/reader/markdown";
import { CursorOverlay } from "@/components/reader/cursor-overlay";
import { FileFinder } from "@/components/search/file-finder";
import { InFileSearch } from "@/components/search/in-file";
import { CommandPalette } from "@/components/command-palette";
import { commands as tauriCommands } from "@/lib/tauri";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useMemo } from "react";

export const Route = createFileRoute("/")({
  component: () => (
    <ReaderProvider>
      <ReaderView />
    </ReaderProvider>
  ),
});

function ReaderView() {
  const { files, currentPath, content, openFile, refreshFiles } = useVault();
  const { favorites, toggleFavorite } = usePrism();
  const { state, dispatch, readerRef } = useReader();

  const vim = useVimMode(readerRef, dispatch, state);

  const handleEditorHandoff = useCallback(async () => {
    if (!currentPath) return;
    const line = vim.getSourceLine();
    try {
      await tauriCommands.openInEditor(currentPath, line);
    } catch (e) {
      console.error("Editor handoff failed:", e);
    }
  }, [currentPath, vim]);

  const scrollReader = useCallback((direction: "up" | "down") => {
    const reader = readerRef.current;
    if (!reader) return;
    reader.scrollBy({
      top: direction === "down" ? 60 : -60,
      behavior: "smooth",
    });
  }, [readerRef]);

  const currentFileName =
    currentPath?.split("/").pop()?.replace(/\.md$/, "") ?? "";

  const paletteCommands = useMemo(
    () => [
      {
        id: "toggle-sidebar",
        label: "Toggle Sidebar",
        shortcut: "Ctrl+B",
        action: () => dispatch({ type: "TOGGLE_SIDEBAR" }),
      },
      {
        id: "toggle-favorite",
        label: "Toggle Favorite",
        shortcut: "Ctrl+D",
        action: () => {
          if (currentPath) toggleFavorite(currentPath, currentFileName);
        },
      },
      {
        id: "find-file",
        label: "Find File",
        shortcut: "Ctrl+P",
        action: () => dispatch({ type: "SET_OVERLAY", overlay: "file-finder" }),
      },
      {
        id: "search-in-file",
        label: "Search in File",
        shortcut: "/",
        action: () => dispatch({ type: "SET_OVERLAY", overlay: "search" }),
      },
      {
        id: "reload-files",
        label: "Reload Files",
        action: () => refreshFiles(),
      },
    ],
    [currentPath, currentFileName, toggleFavorite, refreshFiles, dispatch],
  );

  const shortcutMaps: ShortcutMaps = useMemo(() => {
    const global: Record<string, () => void> = {
      "ctrl+p": () => dispatch({ type: "SET_OVERLAY", overlay: "file-finder" }),
      "ctrl+b": () => dispatch({ type: "TOGGLE_SIDEBAR" }),
      "ctrl+d": () => {
        if (currentPath) toggleFavorite(currentPath, currentFileName);
      },
      "ctrl+k": () => dispatch({ type: "SET_OVERLAY", overlay: "palette" }),
      escape: () => dispatch({ type: "CLOSE_OVERLAY" }),
    };

    const normal: Record<string, () => void> = {
      q: () => getCurrentWindow().close(),
      j: () => scrollReader("down"),
      k: () => scrollReader("up"),
      h: () => readerRef.current?.scrollBy({ left: -60, behavior: "smooth" }),
      l: () => readerRef.current?.scrollBy({ left: 60, behavior: "smooth" }),
      "g g": () => vim.jumpToTop(),
      G: () => vim.jumpToBottom(),
      v: () => vim.enterVisual(),
      V: () => vim.enterVisualLine(),
      i: () => vim.enterInsert(),
      "/": () => dispatch({ type: "SET_OVERLAY", overlay: "search" }),
      ...Object.fromEntries(
        Array.from({ length: 9 }, (_, i) => [
          String(i + 1),
          () => { if (favorites[i]) openFile(favorites[i].path); },
        ]),
      ),
    };

    const insert: Record<string, () => void> = {
      j: () => vim.moveCursor("down"),
      k: () => vim.moveCursor("up"),
      h: () => vim.moveCursor("up"),
      l: () => vim.moveCursor("down"),
      "g g": () => vim.jumpToTop(),
      G: () => vim.jumpToBottom(),
      v: () => vim.enterVisual(),
      V: () => vim.enterVisualLine(),
      i: handleEditorHandoff,
      a: handleEditorHandoff,
      o: handleEditorHandoff,
    };

    const visual: Record<string, () => void> = {
      j: () => vim.moveCursor("down"),
      k: () => vim.moveCursor("up"),
      h: () => vim.moveCursor("up"),
      l: () => vim.moveCursor("down"),
      "g g": () => vim.jumpToTop(),
      G: () => vim.jumpToBottom(),
      y: () => vim.yankSelection(),
      i: handleEditorHandoff,
      a: handleEditorHandoff,
      o: handleEditorHandoff,
    };

    return { global, normal, insert, visual, "visual-line": visual };
  }, [
    vim,
    scrollReader,
    handleEditorHandoff,
    currentPath,
    currentFileName,
    toggleFavorite,
    favorites,
    openFile,
    readerRef,
    dispatch,
  ]);

  useShortcuts(shortcutMaps, state.vimMode, dispatch);

  const showCursor =
    state.vimMode === "visual" ||
    state.vimMode === "visual-line" ||
    state.vimMode === "insert";

  return (
    <>
      <div className="flex flex-1 overflow-hidden">
        {state.sidebarVisible && (
          <aside
            className="w-60 border-r overflow-y-auto shrink-0"
            style={{
              borderColor: "var(--prism-border)",
              background: "var(--prism-sidebar-bg)",
            }}
          >
            <Favorites
              favorites={favorites}
              currentPath={currentPath}
              onSelect={openFile}
            />
            <div
              className="px-3 py-1.5 text-xs font-bold uppercase tracking-widest"
              style={{ color: "var(--prism-muted)" }}
            >
              Files
            </div>
            <FileTree
              nodes={files}
              currentPath={currentPath}
              onSelect={openFile}
            />
          </aside>
        )}

        <main className="flex-1 overflow-y-auto p-6" ref={readerRef}>
          {content ? (
            <>
              <MarkdownViewer content={content} />
              {showCursor && <CursorOverlay lineHeight={vim.lineHeight} />}
            </>
          ) : (
            <div
              className="flex items-center justify-center h-full text-sm"
              style={{ color: "var(--prism-muted)" }}
            >
              Select a file to read
            </div>
          )}
        </main>
      </div>

      {state.overlay === "search" && (
        <InFileSearch
          onClose={() => dispatch({ type: "SET_OVERLAY", overlay: "none" })}
        />
      )}
      <StatusBar filePath={currentPath} content={content} />

      {state.overlay === "file-finder" && (
        <FileFinder
          onSelect={openFile}
          onClose={() => dispatch({ type: "SET_OVERLAY", overlay: "none" })}
        />
      )}
      {state.overlay === "palette" && (
        <CommandPalette
          commands={paletteCommands}
          onClose={() => dispatch({ type: "SET_OVERLAY", overlay: "none" })}
        />
      )}
    </>
  );
}
