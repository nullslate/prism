import { createFileRoute } from "@tanstack/react-router";
import { useVault } from "@/hooks/use-vault";
import { useShortcuts, type ShortcutMaps } from "@/hooks/use-shortcuts";
import { usePrism } from "@/components/prism-provider";
import { ReaderProvider, useReader } from "@/components/reader-provider";
import { StatusBar } from "@/components/status-bar";
import { FileTree } from "@/components/sidebar/file-tree";
import { MarkdownViewer } from "@/components/reader/markdown";
import { SourceEditor } from "@/components/reader/source-editor";
import { FileFinder } from "@/components/search/file-finder";
import { InFileSearch } from "@/components/search/in-file";
import { VaultSearch } from "@/components/search/vault-search";
import { CommandPalette } from "@/components/command-palette";
import { NewFileDialog } from "@/components/new-file-dialog";
import { RenameDialog } from "@/components/rename-dialog";
import { TagFilter } from "@/components/tag-filter";
import { QuickCapture } from "@/components/quick-capture";
import { TemplatePickerDialog } from "@/components/template-picker";
import { LinkGraph } from "@/components/link-graph";
import { ThemePicker } from "@/components/theme-picker";
import { AnimatedOverlay } from "@/components/animated-overlay";
import { SidebarPanel } from "@/components/sidebar-panel";
import { PluginErrorBoundary } from "@/components/plugin-panel";
import { loadPluginBundle, type PluginUI } from "@/lib/plugin-loader";
import { ContentSkeleton } from "@/components/content-skeleton";
import { useToast } from "@/components/toast";
import { commands } from "@/lib/tauri";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { listen } from "@tauri-apps/api/event";
import { log } from "@/lib/logger";
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
  const { files, currentPath, content, loading, openFile, closeFile, refreshFiles, setContent } =
    useVault();
  const { config, shortcuts, favorites, pluginCommands, toggleFavorite } = usePrism();
  const { state, dispatch, readerRef } = useReader();
  const toast = useToast();
  const scrollLineRef = useRef(1);
  const [pluginUIs, setPluginUIs] = useState<Record<string, PluginUI>>({});
  const [pendingTrash, setPendingTrash] = useState<string | null>(null);
  const [justCaptured, setJustCaptured] = useState(false);
  const pendingTrashTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const scrollSaveTimer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    return () => {
      if (pendingTrashTimer.current) clearTimeout(pendingTrashTimer.current);
      if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current);
    };
  }, []);

  const saveScrollPosition = useCallback(() => {
    const reader = readerRef.current;
    if (!reader || !currentPath || state.editorOpen) return;
    if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current);
    scrollSaveTimer.current = setTimeout(() => {
      localStorage.setItem(`prism:scroll:${currentPath}`, String(reader.scrollTop));
    }, 300);
  }, [currentPath, readerRef, state.editorOpen]);

  useEffect(() => {
    if (!currentPath || !content || state.editorOpen) return;
    const reader = readerRef.current;
    if (!reader) return;
    const saved = localStorage.getItem(`prism:scroll:${currentPath}`);
    if (saved) {
      requestAnimationFrame(() => {
        reader.scrollTo({ top: Number(saved) });
      });
    }
  }, [currentPath, content, readerRef, state.editorOpen]);

  useEffect(() => {
    if (!justCaptured || !content) return;
    const reader = readerRef.current;
    if (!reader) return;
    // Wait for markdown to render, then scroll to bottom and mark last item
    const frame = requestAnimationFrame(() => {
      reader.scrollTo({ top: reader.scrollHeight, behavior: "smooth" });
      // Find last list item and add indicator
      const items = reader.querySelectorAll("li");
      const last = items[items.length - 1];
      if (last) {
        last.setAttribute("data-just-captured", "true");
      }
      setTimeout(() => {
        setJustCaptured(false);
        if (last) last.removeAttribute("data-just-captured");
      }, 3000);
    });
    return () => cancelAnimationFrame(frame);
  }, [justCaptured, content, readerRef]);

  useEffect(() => {
    const unlisten = listen("quick-capture", () => {
      dispatch({ type: "SET_OVERLAY", overlay: "capture" });
    });
    return () => { unlisten.then((f) => f()); };
  }, [dispatch]);

  useEffect(() => {
    const unlisten = listen<{ plugin: string; error: string }>("plugin-error", (event) => {
      toast.error(`Plugin "${event.payload.plugin}" failed: ${event.payload.error}`);
    });
    return () => { unlisten.then((f) => f()); };
  }, [toast]);

  useEffect(() => {
    commands.listPlugins().then((plugins) => {
      for (const plugin of plugins) {
        if (plugin.enabled) {
          loadPluginBundle(plugin.name).then((ui) => {
            if (ui) {
              setPluginUIs((prev) => ({ ...prev, [plugin.name]: ui }));
            }
          });
        }
      }
    }).catch(log.error);
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

  const handleEditorSave = useCallback((text: string) => {
    setContent(text);
    dispatch({ type: "SAVE_FLASH" });
  }, [setContent, dispatch]);

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

  const createFromTemplate = useCallback(
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
      localStorage.removeItem(`prism:scroll:${currentPath}`);
      closeFile();
      refreshFiles();
    } catch (e) {
      log.error("Failed to trash file:", e);
    }
  }, [currentPath, closeFile, refreshFiles]);

  const trashFile = useCallback(async (path: string) => {
    try {
      await commands.trashFile(path);
      localStorage.removeItem(`prism:scroll:${path}`);
      if (currentPath === path) closeFile();
      refreshFiles();
    } catch (e) {
      log.error("Failed to trash file:", e);
    }
  }, [currentPath, closeFile, refreshFiles]);

  const handleCapture = useCallback(() => {
    const inbox = config?.inbox ?? "inbox.md";
    openFile(inbox);
    setJustCaptured(true);
  }, [config, openFile]);

  const toggleNearestTodo = useCallback(async () => {
    if (!currentPath || !content) return;
    const reader = readerRef.current;
    if (!reader) return;
    // Find task list items with source line annotations
    const todoItems = reader.querySelectorAll<HTMLElement>(".task-list-item[data-source-line]");
    if (todoItems.length === 0) return;
    const viewportMid = reader.scrollTop + reader.clientHeight / 2;
    let nearest: HTMLElement | null = null;
    let nearestDist = Infinity;
    for (const item of todoItems) {
      const d = Math.abs(item.offsetTop - viewportMid);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = item;
      }
    }
    if (!nearest) return;
    const sourceLine = Number(nearest.dataset.sourceLine);
    if (!sourceLine) return;
    try {
      const newContent = await commands.toggleTodo(currentPath, sourceLine);
      setContent(newContent);
    } catch (e) {
      log.error("Failed to toggle todo:", e);
    }
  }, [currentPath, content, readerRef, setContent]);

  const navigateWikiLink = useCallback(async (target: string) => {
    try {
      const resolved = await commands.resolveWikiLink(target);
      if (resolved) openFile(resolved);
    } catch (e) {
      log.error("Failed to resolve wiki link:", e);
    }
  }, [openFile]);

  const setVault = useCallback(async () => {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: "Select Vault Folder",
    });
    if (!selected || !config) return;
    await commands.setConfig({ ...config, vault: selected });
    toast.info(`Vault: ${selected}`);
    // Config watcher will trigger reload
  }, [config, toast]);


  const renameCurrentFile = useCallback(
    (newPath: string) => {
      dispatch({ type: "CLOSE_OVERLAY" });
      openFile(newPath);
      refreshFiles();
    },
    [dispatch, openFile, refreshFiles],
  );

  const currentFileName =
    currentPath?.split("/").pop()?.replace(/\.md$/, "") ?? "";

  const shortcutLabel = useCallback(
    (actionId: string, scope: "global" | "render" = "global") => {
      if (!shortcuts) return undefined;
      const key = (scope === "global" ? shortcuts.global : shortcuts.render)[actionId];
      if (!key) return undefined;
      if (key.includes(" ") && !key.includes("+")) return key.replace(/\s/g, "");
      return key.split("+").map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join("+");
    },
    [shortcuts],
  );

  const paletteCommands = useMemo(
    () => [
      {
        id: "toggle-sidebar",
        label: "Toggle Sidebar",
        shortcut: shortcutLabel("toggle-sidebar"),
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
        shortcut: shortcutLabel("find-file"),
        action: () =>
          dispatch({ type: "SET_OVERLAY", overlay: "file-finder" }),
      },
      {
        id: "search-in-file",
        label: "Search in File",
        shortcut: shortcutLabel("search-in-file", "render"),
        action: () => dispatch({ type: "SET_OVERLAY", overlay: "search" }),
      },
      {
        id: "reload-files",
        label: "Reload Files",
        action: () => refreshFiles(),
      },
      {
        id: "rename-file",
        label: "Rename / Move File",
        action: () => {
          if (currentPath) dispatch({ type: "SET_OVERLAY", overlay: "rename" });
        },
      },
      {
        id: "move-to-trash",
        label: "Move to Trash",
        shortcut: shortcutLabel("trash-file", "render"),
        action: () => trashCurrentFile(),
      },
      {
        id: "empty-trash",
        label: "Empty Trash",
        action: () => commands.emptyTrash().then(refreshFiles).catch(log.error),
      },
      {
        id: "filter-by-tag",
        label: "Filter by Tag",
        shortcut: shortcutLabel("filter-tags"),
        action: () => dispatch({ type: "SET_OVERLAY", overlay: "tags" }),
      },
      {
        id: "set-vault",
        label: "Set Vault Folder",
        shortcut: shortcutLabel("set-vault"),
        action: () => setVault(),
      },
      {
        id: "open-config",
        label: "Open Config",
        action: () => commands.openConfigInEditor(),
      },
      {
        id: "quick-capture",
        label: "Quick Capture",
        shortcut: shortcutLabel("quick-capture"),
        action: () => dispatch({ type: "SET_OVERLAY", overlay: "capture" }),
      },
      {
        id: "new-from-template",
        label: "New from Template",
        shortcut: shortcutLabel("new-from-template"),
        action: () => dispatch({ type: "SET_OVERLAY", overlay: "template" }),
      },
      {
        id: "link-graph",
        label: "Link Graph",
        shortcut: shortcutLabel("link-graph"),
        action: () => dispatch({ type: "SET_OVERLAY", overlay: "graph" }),
      },
      {
        id: "vault-search",
        label: "Search Vault",
        shortcut: shortcutLabel("vault-search"),
        action: () => dispatch({ type: "SET_OVERLAY", overlay: "vault-search" }),
      },
      {
        id: "switch-theme",
        label: "Switch Theme",
        shortcut: shortcutLabel("cycle-theme"),
        action: () => dispatch({ type: "SET_OVERLAY", overlay: "theme" }),
      },
      {
        id: "show-outline",
        label: "Show Outline",
        action: () => {
          if (!state.sidebarVisible) dispatch({ type: "TOGGLE_SIDEBAR" });
        },
      },
      {
        id: "daily-note",
        label: "Daily Note",
        shortcut: shortcutLabel("daily-note"),
        action: () => {
          commands.createDailyNote().then((path) => {
            openFile(path);
            refreshFiles();
          }).catch(log.error);
        },
      },
      {
        id: "update-plugins",
        label: "Update Plugins",
        action: () => {
          commands.updatePlugins().then((count) => {
            toast.info(`Updated ${count} plugin(s)`);
          }).catch(log.error);
        },
      },
      {
        id: "clean-plugins",
        label: "Clean Unused Plugins",
        action: () => {
          commands.cleanPlugins().then((removed) => {
            toast.info(`Removed ${removed.length} plugin(s)`);
          }).catch(log.error);
        },
      },
    ],
    [currentPath, currentFileName, toggleFavorite, refreshFiles, dispatch, trashCurrentFile, setVault, openFile, shortcutLabel, state.sidebarVisible, toast],
  );

  const allPaletteCommands = useMemo(() => {
    const pluginCmds = pluginCommands.map((cmd) => ({
      id: `plugin:${cmd.plugin}:${cmd.id}`,
      label: cmd.label,
      shortcut: cmd.shortcut ?? undefined,
      action: () => {
        commands.pluginEmit(`command:${cmd.id}`, undefined);
      },
    }));
    return [...paletteCommands, ...pluginCmds];
  }, [paletteCommands, pluginCommands]);

  const shortcutMaps: ShortcutMaps = useMemo(() => {
    const globalActions: Record<string, () => void> = {
      "find-file": () => dispatch({ type: "SET_OVERLAY", overlay: "file-finder" }),
      "toggle-sidebar": () => dispatch({ type: "TOGGLE_SIDEBAR" }),
      "command-palette": () => dispatch({ type: "SET_OVERLAY", overlay: "palette" }),
      "new-file": () => dispatch({ type: "SET_OVERLAY", overlay: "new-file" }),
      "filter-tags": () => dispatch({ type: "SET_OVERLAY", overlay: "tags" }),
      "quick-capture": () => dispatch({ type: "SET_OVERLAY", overlay: "capture" }),
      "new-from-template": () => dispatch({ type: "SET_OVERLAY", overlay: "template" }),
      "link-graph": () => dispatch({ type: "SET_OVERLAY", overlay: "graph" }),
      "cycle-theme": () => dispatch({ type: "SET_OVERLAY", overlay: "theme" }),
      "vault-search": () => dispatch({ type: "SET_OVERLAY", overlay: "vault-search" }),
      "set-vault": () => setVault(),
      "daily-note": () => {
        commands.createDailyNote().then((path) => {
          openFile(path);
          refreshFiles();
        }).catch(log.error);
      },
      "close-overlay": () => dispatch({ type: "CLOSE_OVERLAY" }),
    };

    const renderActions: Record<string, () => void> = {
      "page-down": () => pageScroll("down"),
      "page-up": () => pageScroll("up"),
      quit: () => getCurrentWindow().close(),
      "scroll-down": () => scrollReader("down"),
      "scroll-up": () => scrollReader("up"),
      "scroll-left": () => scrollReader("up"),
      "scroll-right": () => scrollReader("down"),
      "goto-top": () => {
        const reader = readerRef.current;
        if (reader) reader.scrollTo({ top: 0, behavior: "smooth" });
      },
      "goto-bottom": () => {
        const reader = readerRef.current;
        if (reader) reader.scrollTo({ top: reader.scrollHeight, behavior: "smooth" });
      },
      "open-editor": () => openEditor(),
      "toggle-todo": () => toggleNearestTodo(),
      "search-in-file": () => dispatch({ type: "SET_OVERLAY", overlay: "search" }),
      "trash-file": () => {
        if (!currentPath) return;
        if (pendingTrash === currentPath) {
          if (pendingTrashTimer.current) clearTimeout(pendingTrashTimer.current);
          setPendingTrash(null);
          trashCurrentFile();
        } else {
          setPendingTrash(currentPath);
          if (pendingTrashTimer.current) clearTimeout(pendingTrashTimer.current);
          pendingTrashTimer.current = setTimeout(() => setPendingTrash(null), 2000);
        }
      },
      ...Object.fromEntries(
        Array.from({ length: 9 }, (_, i) => [
          `favorite-${i + 1}`,
          () => { if (favorites[i]) openFile(favorites[i].path); },
        ]),
      ),
    };

    const buildKeyMap = (
      actions: Record<string, () => void>,
      keyConfig: Record<string, string>,
    ): Record<string, () => void> => {
      const keyMap: Record<string, () => void> = {};
      for (const [actionId, handler] of Object.entries(actions)) {
        const key = keyConfig[actionId];
        if (key) keyMap[key] = handler;
      }
      return keyMap;
    };

    const sc = shortcuts ?? { global: {}, render: {} };
    return {
      global: buildKeyMap(globalActions, sc.global),
      render: buildKeyMap(renderActions, sc.render),
      sidebar: {},
    };
  }, [
    shortcuts,
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
    toggleNearestTodo,
    setVault,
  ]);

  const currentMode = state.editorOpen ? "editor" : state.sidebarVisible ? "sidebar" : "render";
  useShortcuts(shortcutMaps, currentMode, dispatch);

  return (
    <>
      <div className="flex flex-1 overflow-hidden">
        <SidebarPanel visible={state.sidebarVisible}>
            <div
              className="flex items-center border-b px-3 gap-2 shrink-0"
              style={{ borderColor: "var(--prism-border)" }}
              data-tauri-drag-region
            >
              <span style={{ color: "var(--prism-muted)" }}>&#x2636;</span>
              <span
                className="text-xs font-bold uppercase tracking-widest flex-1 py-2.5"
                style={{ color: "var(--prism-muted)" }}
              >
                Files
              </span>
              <button
                onClick={() => dispatch({ type: "TOGGLE_SIDEBAR" })}
                className="w-7 h-7 flex items-center justify-center text-sm hover:opacity-80"
                style={{ color: "var(--prism-muted)" }}
              >
                &#x00D7;
              </button>
            </div>
            <div
              className="px-3 py-1 text-xs border-b shrink-0"
              style={{ color: "var(--prism-muted)", borderColor: "var(--prism-border)" }}
            >
              j/k nav | o open | h/l collapse/expand | R rename | dd trash
            </div>
            {Object.entries(pluginUIs).map(([name, ui]) =>
              ui.sidebar ? (
                <PluginErrorBoundary key={name} pluginName={name}>
                  <ui.sidebar />
                </PluginErrorBoundary>
              ) : null
            )}
            <FileTree
              nodes={files}
              currentPath={currentPath}
              onSelect={(path) => {
                openFile(path);
                dispatch({ type: "TOGGLE_SIDEBAR" });
              }}
              onTrash={trashFile}
              onRename={renameCurrentFile}
              onRefresh={refreshFiles}
              onClose={() => dispatch({ type: "TOGGLE_SIDEBAR" })}
            />
        </SidebarPanel>

        {state.editorOpen && currentPath && content != null ? (
          <SourceEditor
            content={content}
            filePath={currentPath}
            scrollLine={scrollLineRef.current}
            onSave={handleEditorSave}
            onExit={closeEditor}
          />
        ) : (
          <main
            className="flex-1 overflow-y-auto py-6 pr-6 pl-16"
            ref={readerRef}
            onScroll={saveScrollPosition}
          >
            {loading ? (
              <ContentSkeleton />
            ) : content ? (
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

      <AnimatedOverlay visible={state.overlay === "file-finder"}>
        <FileFinder
          onSelect={(path) => { openFile(path); dispatch({ type: "CLOSE_OVERLAY" }); }}
          onClose={() => dispatch({ type: "CLOSE_OVERLAY" })}
        />
      </AnimatedOverlay>
      <AnimatedOverlay visible={state.overlay === "palette"}>
        <CommandPalette
          commands={allPaletteCommands}
          onClose={() => dispatch({ type: "CLOSE_OVERLAY" })}
        />
      </AnimatedOverlay>
      <AnimatedOverlay visible={state.overlay === "new-file"}>
        <NewFileDialog
          onCreate={createFile}
          onClose={() => dispatch({ type: "CLOSE_OVERLAY" })}
        />
      </AnimatedOverlay>
      <AnimatedOverlay visible={state.overlay === "rename"}>
        {currentPath && (
          <RenameDialog
            currentPath={currentPath}
            onRename={renameCurrentFile}
            onClose={() => dispatch({ type: "CLOSE_OVERLAY" })}
          />
        )}
      </AnimatedOverlay>
      <AnimatedOverlay visible={state.overlay === "tags"}>
        <TagFilter
          onSelect={(path) => {
            openFile(path);
            dispatch({ type: "CLOSE_OVERLAY" });
          }}
          onClose={() => dispatch({ type: "CLOSE_OVERLAY" })}
        />
      </AnimatedOverlay>
      <AnimatedOverlay visible={state.overlay === "capture"}>
        <QuickCapture
          onCapture={handleCapture}
          onClose={() => dispatch({ type: "CLOSE_OVERLAY" })}
        />
      </AnimatedOverlay>
      <AnimatedOverlay visible={state.overlay === "template"}>
        <TemplatePickerDialog
          onCreate={createFromTemplate}
          onClose={() => dispatch({ type: "CLOSE_OVERLAY" })}
        />
      </AnimatedOverlay>
      <AnimatedOverlay visible={state.overlay === "vault-search"}>
        <VaultSearch
          onSelect={(path) => { openFile(path); dispatch({ type: "CLOSE_OVERLAY" }); }}
          onClose={() => dispatch({ type: "CLOSE_OVERLAY" })}
        />
      </AnimatedOverlay>
      <AnimatedOverlay visible={state.overlay === "theme"}>
        <ThemePicker
          onClose={() => dispatch({ type: "CLOSE_OVERLAY" })}
        />
      </AnimatedOverlay>
      <AnimatedOverlay visible={state.overlay === "graph"}>
        <LinkGraph
          currentPath={currentPath}
          onSelect={(path) => { openFile(path); dispatch({ type: "CLOSE_OVERLAY" }); }}
          onClose={() => dispatch({ type: "CLOSE_OVERLAY" })}
        />
      </AnimatedOverlay>
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
