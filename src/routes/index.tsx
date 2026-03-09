import { createFileRoute } from "@tanstack/react-router";
import { useVault } from "@/hooks/use-vault";
import { useShortcuts, type ShortcutMaps } from "@/hooks/use-shortcuts";
import { usePrism } from "@/components/prism-provider";
import { ReaderProvider, useReader } from "@/components/reader-provider";
import { StatusBar } from "@/components/status-bar";
import { FileTree } from "@/components/sidebar/file-tree";
import { Favorites } from "@/components/sidebar/favorites";
import { MarkdownViewer } from "@/components/reader/markdown";
import { SourceEditor } from "@/components/reader/source-editor";
import { FileFinder } from "@/components/search/file-finder";
import { InFileSearch } from "@/components/search/in-file";
import { CommandPalette } from "@/components/command-palette";
import { NewFileDialog } from "@/components/new-file-dialog";
import { TagFilter } from "@/components/tag-filter";
import { QuickCapture } from "@/components/quick-capture";
import { commands } from "@/lib/tauri";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const Route = createFileRoute("/")(
  {
  component: () => (
    <ReaderProvider>
      <ReaderView />
    </ReaderProvider>
  ),
});

function ReaderView() {
  const { files, currentPath, content, openFile, closeFile, refreshFiles, setContent } =
    useVault();
  const { favorites, toggleFavorite } = usePrism();
  const { state, dispatch, readerRef } = useReader();
  const scrollLineRef = useRef(1);
  const [pendingTrash, setPendingTrash] = useState<string | null>(null);
  const pendingTrashTimer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (pendingTrashTimer.current) clearTimeout(pendingTrashTimer.current);
    };
  }, []);

  const scrollReader = useCallback(
    (direction: "up" | "down", amount?: number) => {
      const reader = readerRef.current;
      if (!reader) return;
      const delta = amount ?? 48;
      reader.scrollBy({
        top: direction === "down" ? delta : -delta,
      });
    },
    [readerRef],
  );

  const pageScroll = useCallback(
    (direction: "up" | "down") => {
      const reader = readerRef.current;
      if (!reader) return;
      const half = Math.floor(reader.clientHeight / 2);
      reader.scrollBy({
        top: direction === "down" ? half : -half,
        behavior: "smooth",
      });
    },
    [readerRef],
  );

  const getScrollLine = useCallback(() => {
    const reader = readerRef.current;
    if (!reader) return 1;
    const viewportMid = reader.scrollTop + reader.clientHeight / 2;
    const elements = reader.querySelectorAll<HTMLElement>("[data-source-line]");
    let closest = 1;
    let closestDist = Infinity;
    for (const el of elements) {
      const dist = Math.abs(el.offsetTop - viewportMid);
      if (dist < closestDist) {
        closestDist = dist;
        closest = Number(el.dataset.sourceLine) || 1;
      }
    }
    return closest;
  }, [readerRef]);

  const openEditor = useCallback(() => {
    if (!currentPath || !content) return;
    scrollLineRef.current = getScrollLine();
    dispatch({ type: "OPEN_EDITOR" });
  }, [currentPath, content, getScrollLine, dispatch]);

  const closeEditor = useCallback(() => {
    dispatch({ type: "CLOSE_EDITOR" });
  }, [dispatch]);

  const createFile = useCallback(
    (path: string) => {
      openFile(path).then(() => {
        dispatch({ type: "CLOSE_OVERLAY" });
        scrollLineRef.current = 1;
        dispatch({ type: "OPEN_EDITOR" });
      });
    },
    [openFile, dispatch],
  );

  const trashCurrentFile = useCallback(async () => {
    if (!currentPath) return;
    try {
      await commands.trashFile(currentPath);
      closeFile();
      refreshFiles();
    } catch (e) {
      console.error("Failed to trash file:", e);
    }
  }, [currentPath, closeFile, refreshFiles]);

  const trashFile = useCallback(async (path: string) => {
    try {
      await commands.trashFile(path);
      if (currentPath === path) closeFile();
      refreshFiles();
    } catch (e) {
      console.error("Failed to trash file:", e);
    }
  }, [currentPath, closeFile, refreshFiles]);

  const navigateWikiLink = useCallback(async (target: string) => {
    try {
      const resolved = await commands.resolveWikiLink(target);
      if (resolved) openFile(resolved);
    } catch (e) {
      console.error("Failed to resolve wiki link:", e);
    }
  }, [openFile]);

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
        action: () => {
          if (currentPath) toggleFavorite(currentPath, currentFileName);
        },
      },
      {
        id: "find-file",
        label: "Find File",
        shortcut: "Ctrl+P",
        action: () =>
          dispatch({ type: "SET_OVERLAY", overlay: "file-finder" }),
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
      {
        id: "move-to-trash",
        label: "Move to Trash",
        shortcut: "dd",
        action: () => trashCurrentFile(),
      },
      {
        id: "empty-trash",
        label: "Empty Trash",
        action: () => commands.emptyTrash().then(refreshFiles).catch(console.error),
      },
      {
        id: "filter-by-tag",
        label: "Filter by Tag",
        shortcut: "Ctrl+T",
        action: () => dispatch({ type: "SET_OVERLAY", overlay: "tags" }),
      },
      {
        id: "open-config",
        label: "Open Config",
        action: () => commands.openConfigInEditor(),
      },
      {
        id: "quick-capture",
        label: "Quick Capture",
        shortcut: "Ctrl+.",
        action: () => dispatch({ type: "SET_OVERLAY", overlay: "capture" }),
      },
    ],
    [currentPath, currentFileName, toggleFavorite, refreshFiles, dispatch, trashCurrentFile],
  );

  const shortcutMaps: ShortcutMaps = useMemo(() => {
    const global: Record<string, () => void> = {
      "ctrl+p": () =>
        dispatch({ type: "SET_OVERLAY", overlay: "file-finder" }),
      "ctrl+b": () => dispatch({ type: "TOGGLE_SIDEBAR" }),
      "ctrl+k": () => dispatch({ type: "SET_OVERLAY", overlay: "palette" }),
      "ctrl+n": () => dispatch({ type: "SET_OVERLAY", overlay: "new-file" }),
      "ctrl+t": () => dispatch({ type: "SET_OVERLAY", overlay: "tags" }),
      "ctrl+.": () => dispatch({ type: "SET_OVERLAY", overlay: "capture" }),
      escape: () => dispatch({ type: "CLOSE_OVERLAY" }),
    };

    // Render mode: reading shortcuts only
    const render: Record<string, () => void> = {
      "ctrl+d": () => pageScroll("down"),
      "ctrl+u": () => pageScroll("up"),
      q: () => getCurrentWindow().close(),
      j: () => scrollReader("down"),
      k: () => scrollReader("up"),
      h: () => scrollReader("up"),
      l: () => scrollReader("down"),
      "g g": () => {
        const reader = readerRef.current;
        if (reader) reader.scrollTo({ top: 0, behavior: "smooth" });
      },
      G: () => {
        const reader = readerRef.current;
        if (reader) reader.scrollTo({ top: reader.scrollHeight, behavior: "smooth" });
      },
      n: () => openEditor(),
      "/": () => dispatch({ type: "SET_OVERLAY", overlay: "search" }),
      "d d": () => {
        if (!currentPath) return;
        if (pendingTrash === currentPath) {
          // Second dd within timeout — confirm trash
          if (pendingTrashTimer.current) clearTimeout(pendingTrashTimer.current);
          setPendingTrash(null);
          trashCurrentFile();
        } else {
          // First dd — set pending
          setPendingTrash(currentPath);
          if (pendingTrashTimer.current) clearTimeout(pendingTrashTimer.current);
          pendingTrashTimer.current = setTimeout(() => setPendingTrash(null), 2000);
        }
      },
      ...Object.fromEntries(
        Array.from({ length: 9 }, (_, i) => [
          String(i + 1),
          () => {
            if (favorites[i]) openFile(favorites[i].path);
          },
        ]),
      ),
    };

    return { global, render };
  }, [
    scrollReader,
    pageScroll,
    favorites,
    openFile,
    readerRef,
    dispatch,
    openEditor,
    currentPath,
    pendingTrash,
    trashCurrentFile,
  ]);

  useShortcuts(shortcutMaps, state.editorOpen ? "editor" : "render", dispatch);

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
              onTrash={trashFile}
            />
          </aside>
        )}

        {state.editorOpen && currentPath && content != null ? (
          <SourceEditor
            content={content}
            filePath={currentPath}
            scrollLine={scrollLineRef.current}
            onSave={setContent}
            onExit={closeEditor}
          />
        ) : (
          <main
            className="flex-1 overflow-y-auto py-6 pr-6 pl-16"
            ref={readerRef}
          >
            {content ? (
              <MarkdownViewer content={content} onNavigate={navigateWikiLink} />
            ) : (
              <div
                className="flex items-center justify-center h-full text-sm"
                style={{ color: "var(--prism-muted)" }}
              >
                Select a file to read
              </div>
            )}
          </main>
        )}
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
      {state.overlay === "new-file" && (
        <NewFileDialog
          onCreate={createFile}
          onClose={() => dispatch({ type: "SET_OVERLAY", overlay: "none" })}
        />
      )}
      {state.overlay === "tags" && (
        <TagFilter
          onSelect={(path) => {
            openFile(path);
            dispatch({ type: "SET_OVERLAY", overlay: "none" });
          }}
          onClose={() => dispatch({ type: "SET_OVERLAY", overlay: "none" })}
        />
      )}
      {state.overlay === "capture" && (
        <QuickCapture
          onClose={() => dispatch({ type: "SET_OVERLAY", overlay: "none" })}
        />
      )}
      {pendingTrash && (
        <div
          className="fixed bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded text-sm z-50"
          style={{
            background: "var(--prism-code-bg)",
            color: "var(--prism-accent)",
            fontFamily: "var(--font-mono)",
            border: "1px solid var(--prism-border)",
          }}
        >
          Press dd again to confirm delete
        </div>
      )}
    </>
  );
}
