import { ViewPlugin, type DecorationSet, Decoration, EditorView, type PluginValue, WidgetType, type ViewUpdate } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder } from "@codemirror/state";

// Conceals markdown syntax markers when the cursor is not on the same line,
// mirroring how nvim's markdown plugins (render-markdown.nvim, etc.) feel.

class BulletWidget extends WidgetType {
  constructor(private readonly ch: string) {
    super();
  }
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.textContent = this.ch;
    span.className = "cm-conceal-bullet";
    return span;
  }
  eq(other: BulletWidget): boolean {
    return other.ch === this.ch;
  }
}

class WikiLinkWidget extends WidgetType {
  constructor(private readonly label: string) {
    super();
  }
  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.textContent = this.label;
    span.className = "cm-conceal-wikilink";
    return span;
  }
  eq(other: WikiLinkWidget): boolean {
    return other.label === this.label;
  }
}

interface PendingDeco {
  from: number;
  to: number;
  deco: Decoration;
}

function buildDecorations(view: EditorView): DecorationSet {
  const cursorLine = view.state.doc.lineAt(view.state.selection.main.head).number;
  const doc = view.state.doc;
  const pending: PendingDeco[] = [];

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter(node) {
        const lineNum = doc.lineAt(node.from).number;
        if (lineNum === cursorLine) return;

        const name = node.type.name;

        if (name === "HeaderMark") {
          const after = doc.sliceString(node.to, Math.min(node.to + 2, doc.length));
          const extra = after.startsWith(" ") ? 1 : 0;
          pending.push({ from: node.from, to: node.to + extra, deco: Decoration.replace({}) });
          return;
        }

        if (name === "EmphasisMark" || name === "StrongMark" || name === "CodeMark") {
          pending.push({ from: node.from, to: node.to, deco: Decoration.replace({}) });
          return;
        }

        if (name === "LinkMark" || name === "URL") {
          pending.push({ from: node.from, to: node.to, deco: Decoration.replace({}) });
          return;
        }

        if (name === "QuoteMark") {
          const after = doc.sliceString(node.to, Math.min(node.to + 2, doc.length));
          const extra = after.startsWith(" ") ? 1 : 0;
          pending.push({
            from: node.from,
            to: node.to + extra,
            deco: Decoration.replace({ widget: new BulletWidget("┃ ") }),
          });
          return;
        }

        if (name === "ListMark") {
          const text = doc.sliceString(node.from, node.to);
          if (/^\d+\./.test(text)) return;
          pending.push({
            from: node.from,
            to: node.to,
            deco: Decoration.replace({ widget: new BulletWidget("•") }),
          });
          return;
        }
      },
    });

    // Wiki links [[target|alias]] / [[target#heading]]
    const text = doc.sliceString(from, to);
    const matches = Array.from(text.matchAll(/\[\[([^\]]+)\]\]/g));
    for (const m of matches) {
      const idx = m.index ?? 0;
      const absFrom = from + idx;
      const absTo = absFrom + m[0].length;
      const lineNum = doc.lineAt(absFrom).number;
      if (lineNum === cursorLine) continue;
      const inner = m[1];
      const display = (inner.split("|")[1] ?? inner.split("#")[0] ?? inner).trim();
      pending.push({
        from: absFrom,
        to: absTo,
        deco: Decoration.replace({ widget: new WikiLinkWidget(display) }),
      });
    }
  }

  pending.sort((a, b) => (a.from - b.from) || (a.to - b.to));
  const builder = new RangeSetBuilder<Decoration>();
  let lastEnd = -1;
  for (const p of pending) {
    if (p.from < lastEnd) continue; // skip overlap (wiki vs link mark)
    builder.add(p.from, p.to, p.deco);
    lastEnd = p.to;
  }
  return builder.finish();
}

export const markdownConceal = ViewPlugin.fromClass(
  class implements PluginValue {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged || u.selectionSet) {
        this.decorations = buildDecorations(u.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    provide: (plugin) =>
      EditorView.atomicRanges.of((view) => {
        return view.plugin(plugin)?.decorations ?? Decoration.none;
      }),
  },
);

export const concealTheme = EditorView.theme({
  ".cm-conceal-bullet": {
    color: "var(--prism-accent)",
    opacity: 0.85,
  },
  ".cm-conceal-wikilink": {
    color: "var(--prism-accent)",
    textDecoration: "underline",
    textUnderlineOffset: "2px",
    textDecorationColor: "color-mix(in srgb, var(--prism-accent) 50%, transparent)",
  },
});
