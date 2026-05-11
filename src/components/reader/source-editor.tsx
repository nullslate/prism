import { useEffect, useRef, useState } from "react";
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from "@codemirror/view";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { history, historyKeymap } from "@codemirror/commands";
import { keymap, Decoration, type DecorationSet } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { vim, Vim, getCM } from "@replit/codemirror-vim";
import { commands } from "@/lib/tauri";
import { log } from "@/lib/logger";
import { autocompletion, type CompletionContext, type CompletionResult } from "@codemirror/autocomplete";
import type { FileNode } from "@/lib/types";
import { EditorCheatsheet } from "./editor-cheatsheet";
import { EditorLeaderHint } from "./editor-leader-hint";
import { markdownConceal, concealTheme } from "./markdown-conceal";

export type VimMode = "NORMAL" | "INSERT" | "VISUAL" | "V-LINE" | "V-BLOCK" | "REPLACE" | "EX";

export type EditorIntent =
  | { type: "find-file" }
  | { type: "grep" }
  | { type: "buffers" }
  | { type: "palette" }
  | { type: "navigate-wiki"; target: string }
  | { type: "jump-back" }
  | { type: "jump-forward" };

interface SourceEditorProps {
  content: string;
  filePath: string;
  scrollLine: number;
  onSave: (content: string) => void;
  onExit: () => void;
  onModeChange?: (mode: VimMode) => void;
  onIntent?: (intent: EditorIntent) => void;
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

// --- Wiki link extraction at cursor ---

function wikiLinkAt(view: EditorView, pos: number): string | null {
  const line = view.state.doc.lineAt(pos);
  const text = line.text;
  const col = pos - line.from;
  // Find [[ before col and ]] at or after col
  const open = text.lastIndexOf("[[", col);
  if (open === -1) return null;
  const close = text.indexOf("]]", open);
  if (close === -1 || close < col) return null;
  const inner = text.slice(open + 2, close);
  // Strip alias / anchor
  const target = inner.split("|")[0].split("#")[0].trim();
  return target || null;
}

// --- Vim configuration (runs once, globally) ---

let _vimConfigured = false;
let _intentHandler: ((i: EditorIntent) => void) | null = null;
let _exitHandler: (() => void) | null = null;
let _saveHandler: ((exitAfter: boolean) => void) | null = null;
let _toggleCheatsheet: (() => void) | null = null;

function ensureVimConfig() {
  if (_vimConfigured) return;
  _vimConfigured = true;

  // Free <Space> so we can use it as leader, and free `?` so we can repurpose it for help.
  (Vim.unmap as (lhs: string, ctx?: string) => any)("<Space>");
  try { (Vim.unmap as (lhs: string, ctx?: string) => any)("?"); } catch {}
  try { (Vim.unmap as (lhs: string, ctx?: string) => any)("?", "normal"); } catch {}

  // --- Clipboard yank ---
  Vim.defineAction("clipboard-yank", (cm: any) => {
    const view = cm.cm6 as EditorView;
    const sel = view.state.selection.main;
    if (sel.from === sel.to) return;
    const text = view.state.sliceDoc(sel.from, sel.to);
    commands.copyToClipboard(text).catch(log.error);
    flashView(view, sel.from, sel.to);
    Vim.exitVisualMode(cm);
  });
  Vim.mapCommand("<Space>y", "action", "clipboard-yank", {}, { context: "visual" });

  Vim.defineAction("clipboard-yank-line", (cm: any) => {
    const view = cm.cm6 as EditorView;
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    commands.copyToClipboard(line.text).catch(log.error);
    flashView(view, line.from, line.to);
  });
  Vim.mapCommand("<Space>yy", "action", "clipboard-yank-line", {}, { context: "normal" });

  // --- Todos ---
  Vim.defineAction("todo-toggle", (cm: any) => {
    const view = cm.cm6 as EditorView;
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    const text = line.text;
    if (text.includes("- [ ] ")) {
      view.dispatch({ changes: { from: line.from, to: line.to, insert: text.replace("- [ ] ", "- [x] ") } });
    } else if (text.includes("- [x] ")) {
      view.dispatch({ changes: { from: line.from, to: line.to, insert: text.replace("- [x] ", "- [ ] ") } });
    } else {
      const match = text.match(/^(\s*)(- )?(.*)$/);
      if (match) {
        const indent = match[1];
        const content = match[3];
        view.dispatch({ changes: { from: line.from, to: line.to, insert: `${indent}- [ ] ${content}` } });
      }
    }
  });
  Vim.mapCommand("<Space>tt", "action", "todo-toggle", {}, { context: "normal" });

  Vim.defineAction("todo-new", (cm: any) => {
    const view = cm.cm6 as EditorView;
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    const indent = line.text.match(/^(\s*)/)?.[1] ?? "";
    const newTodo = `\n${indent}- [ ] `;
    view.dispatch({
      changes: { from: line.to, insert: newTodo },
      selection: { anchor: line.to + newTodo.length },
    });
    Vim.handleKey(cm, "i", "mapping");
  });
  Vim.mapCommand("<Space>tn", "action", "todo-new", {}, { context: "normal" });

  Vim.defineAction("todo-wrap", (cm: any) => {
    const view = cm.cm6 as EditorView;
    const head = view.state.selection.main.head;
    const line = view.state.doc.lineAt(head);
    const text = line.text;
    if (text.match(/^\s*- \[[ x]\] /)) return;
    const match = text.match(/^(\s*)(- |\* )?(.*)$/);
    if (match) {
      const indent = match[1];
      const content = match[3];
      view.dispatch({ changes: { from: line.from, to: line.to, insert: `${indent}- [ ] ${content}` } });
    }
  });
  Vim.mapCommand("<Space>ta", "action", "todo-wrap", {}, { context: "normal" });

  // --- File / quit intents (routed to React) ---
  Vim.defineAction("prism-find-file", () => _intentHandler?.({ type: "find-file" }));
  Vim.defineAction("prism-grep", () => _intentHandler?.({ type: "grep" }));
  Vim.defineAction("prism-buffers", () => _intentHandler?.({ type: "buffers" }));
  Vim.defineAction("prism-palette", () => _intentHandler?.({ type: "palette" }));
  Vim.defineAction("prism-save", () => _saveHandler?.(true));
  Vim.defineAction("prism-save-only", () => _saveHandler?.(false));
  Vim.defineAction("prism-quit", () => _exitHandler?.());
  Vim.defineAction("prism-cheatsheet", () => _toggleCheatsheet?.());

  Vim.mapCommand("<Space>ff", "action", "prism-find-file", {}, { context: "normal" });
  Vim.mapCommand("<Space>fg", "action", "prism-grep", {}, { context: "normal" });
  Vim.mapCommand("<Space>fb", "action", "prism-buffers", {}, { context: "normal" });
  Vim.mapCommand("<Space>fp", "action", "prism-palette", {}, { context: "normal" });
  // <Space>w saves + returns to reader (notes-app workflow)
  Vim.mapCommand("<Space>w", "action", "prism-save", {}, { context: "normal" });
  Vim.mapCommand("<Space>x", "action", "prism-save", {}, { context: "normal" });
  Vim.mapCommand("<Space>s", "action", "prism-save-only", {}, { context: "normal" });
  Vim.mapCommand("<Space>q", "action", "prism-quit", {}, { context: "normal" });
  Vim.mapCommand("<Space>e", "action", "prism-quit", {}, { context: "normal" });
  Vim.mapCommand("<Space>?", "action", "prism-cheatsheet", {}, { context: "normal" });

  // --- Follow wiki link under cursor ---
  Vim.defineAction("prism-follow-wiki", (cm: any) => {
    const view = cm.cm6 as EditorView;
    const target = wikiLinkAt(view, view.state.selection.main.head);
    if (target) _intentHandler?.({ type: "navigate-wiki", target });
  });
  Vim.mapCommand("gf", "action", "prism-follow-wiki", {}, { context: "normal" });
  Vim.mapCommand("gd", "action", "prism-follow-wiki", {}, { context: "normal" });

  // --- Jump history across files ---
  Vim.defineAction("prism-jump-back", () => _intentHandler?.({ type: "jump-back" }));
  Vim.defineAction("prism-jump-forward", () => _intentHandler?.({ type: "jump-forward" }));
  Vim.mapCommand("<C-o>", "action", "prism-jump-back", {}, { context: "normal" });
  Vim.mapCommand("<C-i>", "action", "prism-jump-forward", {}, { context: "normal" });

  // --- Heading navigation ]] [[ ---
  Vim.defineAction("prism-next-heading", (cm: any) => {
    const view = cm.cm6 as EditorView;
    const head = view.state.selection.main.head;
    const doc = view.state.doc;
    const curLine = doc.lineAt(head).number;
    for (let i = curLine + 1; i <= doc.lines; i++) {
      if (/^#{1,6}\s/.test(doc.line(i).text)) {
        const ln = doc.line(i);
        view.dispatch({ selection: { anchor: ln.from }, scrollIntoView: true });
        return;
      }
    }
  });
  Vim.defineAction("prism-prev-heading", (cm: any) => {
    const view = cm.cm6 as EditorView;
    const head = view.state.selection.main.head;
    const doc = view.state.doc;
    const curLine = doc.lineAt(head).number;
    for (let i = curLine - 1; i >= 1; i--) {
      if (/^#{1,6}\s/.test(doc.line(i).text)) {
        const ln = doc.line(i);
        view.dispatch({ selection: { anchor: ln.from }, scrollIntoView: true });
        return;
      }
    }
  });
  Vim.mapCommand("]]", "action", "prism-next-heading", {}, { context: "normal" });
  Vim.mapCommand("[[", "action", "prism-prev-heading", {}, { context: "normal" });
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
              .catch((err) => log.error("Failed to save image:", err));
          };
          reader.readAsDataURL(file);
          return true;
        }
      }
      return false;
    },
  });
}

// --- Auto-continue lists/todos on Enter (insert mode only) ---

function listContinuation() {
  const listMatch = /^(\s*)([-*+]|\d+\.)\s(\[[ xX]\]\s)?(.*)$/;
  return keymap.of([
    {
      key: "Enter",
      run: (view) => {
        const cm = getCM(view);
        const vimState = (cm as any)?.state?.vim;
        if (vimState && !vimState.insertMode) return false; // let vim handle in normal/visual
        const head = view.state.selection.main.head;
        const line = view.state.doc.lineAt(head);
        const m = line.text.match(listMatch);
        if (!m) return false;
        const indent = m[1];
        const bullet = m[2];
        const todo = m[3] ?? "";
        const rest = m[4];

        // Empty list item → terminate the list
        if (rest.trim() === "" && (todo === "" || todo.trim() === "[]" || /\[[ xX]\]/.test(todo.trim()))) {
          view.dispatch({
            changes: { from: line.from, to: line.to, insert: indent },
            selection: { anchor: line.from + indent.length },
          });
          return true;
        }

        let nextBullet = bullet;
        const numMatch = bullet.match(/^(\d+)\.$/);
        if (numMatch) {
          nextBullet = `${parseInt(numMatch[1], 10) + 1}.`;
        }
        const newTodo = todo ? "[ ] " : "";
        const insert = `\n${indent}${nextBullet} ${newTodo}`;
        view.dispatch({
          changes: { from: head, insert },
          selection: { anchor: head + insert.length },
        });
        return true;
      },
    },
  ]);
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
    borderLeftWidth: "2px",
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
    } else if (node.kind === "markdown" || node.kind === "") {
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

// --- Read current vim mode from CM instance ---

function readVimMode(cm: any): VimMode {
  const v = cm?.state?.vim;
  if (!v) return "NORMAL";
  if (v.insertMode) return "INSERT";
  if (v.visualMode) {
    if (v.visualLine) return "V-LINE";
    if (v.visualBlock) return "V-BLOCK";
    return "VISUAL";
  }
  return "NORMAL";
}

export function SourceEditor({ content, filePath, scrollLine, onSave, onExit, onModeChange, onIntent }: SourceEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onSaveRef = useRef(onSave);
  const onExitRef = useRef(onExit);
  const onModeChangeRef = useRef(onModeChange);
  const onIntentRef = useRef(onIntent);
  onSaveRef.current = onSave;
  onExitRef.current = onExit;
  onModeChangeRef.current = onModeChange;
  onIntentRef.current = onIntent;

  const [showCheatsheet, setShowCheatsheet] = useState(false);
  const [leaderSuffix, setLeaderSuffix] = useState<string | null>(null);
  const leaderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    ensureVimConfig();

    // Wire global handlers (replaced each mount to keep current filePath/callbacks fresh)
    _intentHandler = (i) => onIntentRef.current?.(i);
    _exitHandler = () => onExitRef.current();
    _toggleCheatsheet = () => setShowCheatsheet((v) => !v);

    // One save path used by everything (ex commands, leader maps, Ctrl-S)
    const doSave = (exitAfter: boolean) => {
      const view = viewRef.current;
      if (!view) return;
      const text = view.state.doc.toString();
      commands.writeFile(filePath, text)
        .then(() => {
          onSaveRef.current(text);
          if (exitAfter) onExitRef.current();
        })
        .catch((err) => log.error("Save failed:", err));
    };
    _saveHandler = doSave;

    // Ex commands — save+exit by default since this is a notes app, not vim.
    // `:w!` is provided for save-without-exit if needed.
    Vim.defineEx("write", "w", () => doSave(true));
    Vim.defineEx("wq", "wq", () => doSave(true));
    Vim.defineEx("x", "x", () => doSave(true));
    Vim.defineEx("quit", "q", () => onExitRef.current());

    const state = EditorState.create({
      doc: content,
      extensions: [
        vim({ status: true }),
        EditorView.inputHandler.of((view) => {
          const cm = getCM(view);
          if (!cm) return false;
          const vimState = (cm as any).state?.vim;
          return !!(vimState && !vimState.insertMode);
        }),
        // <C-s> universal save
        keymap.of([
          {
            key: "Mod-s",
            preventDefault: true,
            run: () => {
              _saveHandler?.(true);
              return true;
            },
          },
        ]),
        listContinuation(),
        drawSelection(),
        history(),
        keymap.of(historyKeymap),
        prismTheme,
        concealTheme,
        syntaxHighlighting(prismHighlight),
        markdown(),
        markdownConceal,
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

    // Poll vim mode + leader state ~30fps. Cheap and reliable across all transitions.
    let lastMode: VimMode = "NORMAL";
    const tick = () => {
      const cm = getCM(view);
      if (cm) {
        const m = readVimMode(cm);
        if (m !== lastMode) {
          lastMode = m;
          onModeChangeRef.current?.(m);
        }
      }
    };
    const interval = window.setInterval(tick, 60);

    // Listen for keystrokes to show leader hint when <Space> pressed in normal mode
    const onKeyDown = (e: KeyboardEvent) => {
      const cm = getCM(view);
      if (!cm) return;
      const mode = readVimMode(cm);
      // `?` opens cheatsheet in normal mode regardless of vim mapping state
      if (mode === "NORMAL" && e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        setShowCheatsheet((v) => !v);
        return;
      }
      if (mode !== "NORMAL") {
        if (leaderSuffix !== null) {
          if (leaderTimerRef.current) clearTimeout(leaderTimerRef.current);
          setLeaderSuffix(null);
        }
        return;
      }
      // Track leader sequence
      if (e.key === " " && leaderSuffix === null) {
        if (leaderTimerRef.current) clearTimeout(leaderTimerRef.current);
        setLeaderSuffix("");
        leaderTimerRef.current = setTimeout(() => setLeaderSuffix(null), 1500);
        return;
      }
      if (leaderSuffix !== null) {
        // Any key advances or terminates
        if (e.key === "Escape") {
          if (leaderTimerRef.current) clearTimeout(leaderTimerRef.current);
          setLeaderSuffix(null);
          return;
        }
        if (e.key.length === 1) {
          const next = leaderSuffix + e.key;
          // If next maps to a group, keep showing the next-level hint
          if (next === "f" || next === "t" || next === "y" || next === "g") {
            setLeaderSuffix(next);
            if (leaderTimerRef.current) clearTimeout(leaderTimerRef.current);
            leaderTimerRef.current = setTimeout(() => setLeaderSuffix(null), 1500);
          } else {
            // Terminal action — hide hint
            if (leaderTimerRef.current) clearTimeout(leaderTimerRef.current);
            setLeaderSuffix(null);
          }
        }
      }
    };
    containerRef.current.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearInterval(interval);
      containerRef.current?.removeEventListener("keydown", onKeyDown);
      if (leaderTimerRef.current) clearTimeout(leaderTimerRef.current);
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  return (
    <div className="relative flex-1 overflow-hidden flex flex-col">
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        style={{ background: "var(--prism-bg)" }}
      />
      <EditorLeaderHint visible={leaderSuffix !== null} suffix={leaderSuffix ?? ""} />
      <EditorCheatsheet visible={showCheatsheet} onClose={() => setShowCheatsheet(false)} />
    </div>
  );
}
