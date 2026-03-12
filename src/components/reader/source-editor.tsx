import { useEffect, useRef } from "react";
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from "@codemirror/view";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { history, historyKeymap } from "@codemirror/commands";
import { keymap, Decoration, type DecorationSet } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { vim, Vim, getCM } from "@replit/codemirror-vim";
import { commands } from "@/lib/tauri";
import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import type { FileNode } from "@/lib/types";

interface SourceEditorProps {
  content: string;
  filePath: string;
  scrollLine: number;
  onSave: (content: string) => void;
  onExit: () => void;
}

// --- Yank flash decoration ---

const yankFlashEffect = StateEffect.define<{ from: number; to: number }>();
const clearYankFlash = StateEffect.define<null>();
const yankFlashMark = Decoration.mark({ class: "cm-yank-flash" });

const yankFlashField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decos, tr) {
    for (const e of tr.effects) {
      if (e.is(yankFlashEffect)) {
        return Decoration.set([yankFlashMark.range(e.value.from, e.value.to)]);
      }
      if (e.is(clearYankFlash)) return Decoration.none;
    }
    return decos;
  },
  provide: (f) => EditorView.decorations.from(f),
});

function flashView(view: EditorView, from: number, to: number) {
  view.dispatch({ effects: yankFlashEffect.of({ from, to }) });
  setTimeout(() => {
    view.dispatch({ effects: clearYankFlash.of(null) });
  }, 150);
}

// --- Vim configuration (runs once, globally) ---

let _vimConfigured = false;

function ensureVimConfig() {
  if (_vimConfigured) return;
  _vimConfigured = true;

  // Remove default <Space> → l mapping so it can be used as leader
  // Default mapping has context: undefined, so pass undefined to match
  (Vim.unmap as (lhs: string, ctx?: string) => any)("<Space>");

  // <Space>y in visual — yank selection to system clipboard + flash
  Vim.defineAction("clipboard-yank", (cm: any) => {
    const view = cm.cm6 as EditorView;
    const sel = view.state.selection.main;
    if (sel.from === sel.to) return;
    const text = view.state.sliceDoc(sel.from, sel.to);
    commands.copyToClipboard(text).catch(console.error);
    flashView(view, sel.from, sel.to);
    Vim.exitVisualMode(cm);
  });
  Vim.mapCommand("<Space>y", "action", "clipboard-yank", {}, { context: "visual" });

  // <Space>yy in normal — yank current line to system clipboard + flash
  Vim.defineAction("clipboard-yank-line", (cm: any) => {
    const view = cm.cm6 as EditorView;
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    commands.copyToClipboard(line.text).catch(console.error);
    flashView(view, line.from, line.to);
  });
  Vim.mapCommand("<Space>yy", "action", "clipboard-yank-line", {}, { context: "normal" });
}

// --- Syntax highlighting ---

const prismHighlight = HighlightStyle.define([
  { tag: tags.heading, color: "var(--prism-heading)", fontWeight: "bold" },
  { tag: tags.heading1, color: "var(--prism-heading)", fontWeight: "bold" },
  { tag: tags.heading2, color: "var(--prism-heading)", fontWeight: "bold" },
  { tag: tags.heading3, color: "var(--prism-heading)", fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic", color: "var(--prism-fg)" },
  { tag: tags.strong, fontWeight: "bold", color: "var(--prism-fg)" },
  { tag: tags.keyword, color: "var(--prism-syntax-keyword)" },
  { tag: tags.controlKeyword, color: "var(--prism-syntax-keyword)" },
  { tag: tags.string, color: "var(--prism-syntax-string)" },
  { tag: tags.comment, color: "var(--prism-syntax-comment)", fontStyle: "italic" },
  { tag: tags.name, color: "var(--prism-syntax-function)" },
  { tag: tags.variableName, color: "var(--prism-syntax-variable)" },
  { tag: tags.number, color: "var(--prism-syntax-number)" },
  { tag: tags.operator, color: "var(--prism-syntax-operator)" },
  { tag: tags.typeName, color: "var(--prism-syntax-type)" },
  { tag: tags.link, color: "var(--prism-accent)", textDecoration: "underline" },
  { tag: tags.url, color: "var(--prism-accent)" },
  { tag: tags.monospace, color: "var(--prism-accent)", fontFamily: "var(--font-mono)" },
  { tag: tags.quote, color: "var(--prism-muted)", fontStyle: "italic" },
  { tag: tags.list, color: "var(--prism-accent)" },
  { tag: tags.contentSeparator, color: "var(--prism-border)" },
  { tag: tags.punctuation, color: "var(--prism-muted)" },
  { tag: tags.bracket, color: "var(--prism-muted)" },
]);

// --- Image paste handler ---

function imagePasteHandler() {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const items = event.clipboardData?.items;
      if (!items) return false;

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          event.preventDefault();
          const file = item.getAsFile();
          if (!file) return true;

          const ext = item.type.split("/")[1] === "jpeg" ? "jpg" : item.type.split("/")[1];
          const timestamp = Date.now();
          const filename = `paste-${timestamp}.${ext}`;

          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(",")[1];
            commands
              .saveImage(filename, base64)
              .then((relPath) => {
                const mdImage = `![](${relPath})`;
                const cursor = view.state.selection.main.head;
                view.dispatch({
                  changes: { from: cursor, insert: mdImage },
                  selection: { anchor: cursor + mdImage.length },
                });
              })
              .catch((err) => console.log("Failed to save image:", err));
          };
          reader.readAsDataURL(file);
          return true;
        }
      }
      return false;
    },
  });
}

// --- Relative line numbers ---

function relativeLineNumbers(lineNo: number, state: EditorState): string {
  const cursorLine = state.doc.lineAt(state.selection.main.head).number;
  if (lineNo === cursorLine) return String(lineNo);
  return String(Math.abs(lineNo - cursorLine));
}

// --- Editor theme ---

const prismTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--prism-bg)",
    color: "var(--prism-fg)",
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
    height: "100%",
  },
  ".cm-content": {
    caretColor: "var(--prism-accent)",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--prism-accent)",
  },
  ".cm-activeLine": {
    backgroundColor: "color-mix(in srgb, var(--prism-fg) 5%, transparent)",
  },
  ".cm-gutters": {
    backgroundColor: "var(--prism-sidebar-bg)",
    color: "var(--prism-muted)",
    borderRight: "1px solid var(--prism-border)",
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
    minWidth: "3.5rem",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    paddingRight: "8px",
    paddingLeft: "4px",
    minWidth: "2.5rem",
    textAlign: "right",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "color-mix(in srgb, var(--prism-fg) 8%, transparent)",
    color: "var(--prism-accent)",
  },
  ".cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "var(--prism-selection) !important",
    opacity: "1",
  },
  "&.cm-focused .cm-selectionLayer .cm-selectionBackground": {
    backgroundColor: "color-mix(in srgb, var(--prism-accent) 30%, transparent) !important",
  },
  ".cm-fat-cursor": {
    background: "var(--prism-accent) !important",
    color: "var(--prism-bg) !important",
  },
  ".cm-panels": {
    backgroundColor: "var(--prism-sidebar-bg)",
    color: "var(--prism-fg)",
  },
  ".cm-panels-bottom": {
    borderTop: "1px solid var(--prism-border)",
  },
  ".cm-vim-panel": {
    backgroundColor: "var(--prism-sidebar-bg)",
    color: "var(--prism-fg)",
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
    padding: "2px 8px",
    borderTop: "1px solid var(--prism-border)",
  },
  ".cm-vim-panel input": {
    color: "var(--prism-fg)",
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
    backgroundColor: "transparent",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "inherit",
    scrollbarWidth: "none",
  },
  ".cm-scroller::-webkit-scrollbar": {
    display: "none",
  },
  ".cm-line": {
    padding: "0 4px",
  },
  ".cm-yank-flash": {
    backgroundColor: "color-mix(in srgb, var(--prism-accent) 40%, transparent)",
    borderRadius: "2px",
  },
  ".cm-tooltip.cm-tooltip-autocomplete": {
    backgroundColor: "var(--prism-bg)",
    border: "1px solid var(--prism-border)",
    fontFamily: "var(--font-mono)",
    fontSize: "13px",
  },
  ".cm-tooltip-autocomplete ul li": {
    color: "var(--prism-fg)",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "var(--prism-selection)",
    color: "var(--prism-fg)",
  },
  ".cm-completionLabel": {
    color: "var(--prism-fg)",
  },
  ".cm-completionDetail": {
    color: "var(--prism-muted)",
    fontStyle: "normal",
    marginLeft: "0.5em",
  },
});

// --- Wiki link autocomplete ---

function flattenFiles(nodes: FileNode[]): { name: string; path: string }[] {
  const result: { name: string; path: string }[] = [];
  for (const node of nodes) {
    if (node.is_dir) {
      result.push(...flattenFiles(node.children));
    } else {
      const name = node.name.replace(/\.md$/, "");
      result.push({ name, path: node.path });
    }
  }
  return result;
}

async function wikiLinkCompletionSource(
  context: CompletionContext,
): Promise<CompletionResult | null> {
  const line = context.state.doc.lineAt(context.pos);
  const textBefore = line.text.slice(0, context.pos - line.from);
  const bracketIdx = textBefore.lastIndexOf("[[");
  if (bracketIdx === -1) return null;

  const afterBracket = textBefore.slice(bracketIdx + 2);
  if (afterBracket.includes("]]")) return null;

  const from = line.from + bracketIdx + 2;
  const query = afterBracket;
  const hashIdx = query.indexOf("#");

  if (hashIdx >= 0) {
    const fileName = query.slice(0, hashIdx);
    const headingQuery = query.slice(hashIdx + 1).toLowerCase();

    try {
      const resolved = await commands.resolveWikiLink(fileName);
      if (!resolved) return { from: from + hashIdx + 1, options: [] };

      const headings = await commands.getFileHeadings(resolved);
      const options = headings
        .filter((h) => h.text.toLowerCase().includes(headingQuery))
        .map((h) => ({
          label: h.text,
          detail: `H${h.level}`,
          apply: (view: EditorView, _completion: any, f: number, to: number) => {
            view.dispatch({
              changes: { from: f, to, insert: `${h.text}]]` },
            });
          },
        }));

      return { from: from + hashIdx + 1, options };
    } catch {
      return null;
    }
  }

  try {
    let options;
    if (query.length === 0) {
      const tree = await commands.listFiles();
      const files = flattenFiles(tree);
      options = files.map((f) => ({
        label: f.name,
        detail: f.path,
        apply: (view: EditorView, _completion: any, f2: number, to: number) => {
          view.dispatch({
            changes: { from: f2, to, insert: `${f.name}]]` },
          });
        },
      }));
    } else {
      const results = await commands.fuzzySearch(query);
      options = results.map((r) => ({
        label: r.name,
        detail: r.path,
        apply: (view: EditorView, _completion: any, f2: number, to: number) => {
          view.dispatch({
            changes: { from: f2, to, insert: `${r.name}]]` },
          });
        },
      }));
    }
    return { from, options };
  } catch {
    return null;
  }
}

export function SourceEditor({ content, filePath, scrollLine, onSave, onExit }: SourceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onSaveRef = useRef(onSave);
  const onExitRef = useRef(onExit);
  onSaveRef.current = onSave;
  onExitRef.current = onExit;

  useEffect(() => {
    if (!containerRef.current) return;

    // Configure vim mappings once globally
    ensureVimConfig();

    // Ex commands (re-register each mount to capture current filePath/callbacks)
    Vim.defineEx("write", "w", (cm) => {
      const view = (cm as { cm6: EditorView }).cm6;
      const text = view.state.doc.toString();
      commands.writeFile(filePath, text)
        .then(() => onSaveRef.current(text))
        .catch((err) => console.error("Save failed:", err));
    });

    Vim.defineEx("quit", "q", () => {
      onExitRef.current();
    });

    Vim.defineEx("wq", "wq", (cm) => {
      const view = (cm as { cm6: EditorView }).cm6;
      const text = view.state.doc.toString();
      commands.writeFile(filePath, text)
        .then(() => {
          onSaveRef.current(text);
          onExitRef.current();
        })
        .catch((err) => console.error("Save failed:", err));
    });

    const state = EditorState.create({
      doc: content,
      extensions: [
        vim({ status: true }),
        // Block text insertion fallthrough in normal/visual mode
        EditorView.inputHandler.of((view) => {
          const cm = getCM(view);
          if (!cm) return false;
          const vimState = (cm as any).state?.vim;
          return !!(vimState && !vimState.insertMode);
        }),
        drawSelection(),
        history(),
        keymap.of(historyKeymap),
        prismTheme,
        syntaxHighlighting(prismHighlight),
        markdown(),
        lineNumbers({ formatNumber: relativeLineNumbers }),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        yankFlashField,
        imagePasteHandler(),
        autocompletion({
          override: [wikiLinkCompletionSource],
          activateOnTyping: true,
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    requestAnimationFrame(() => {
      const targetLine = Math.min(scrollLine, view.state.doc.lines);
      const line = view.state.doc.line(targetLine);
      view.dispatch({
        selection: { anchor: line.from },
        scrollIntoView: true,
      });
      view.focus();

      const cm = getCM(view);
      if (cm) {
        Vim.handleKey(cm, "<Esc>", "mapping");
      }
    });

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-hidden"
      style={{ background: "var(--prism-bg)" }}
    />
  );
}
