import { StateEffect, StateField, type Range, type Text } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";

export type Severity = "error" | "warning" | "hint" | "ok";
export type CodeAnnotation = { line: number; text: string; severity: Severity };

/** Replace all annotations (an empty list clears). */
export const setAnnotationsEffect = StateEffect.define<CodeAnnotation[]>();

const ICON: Record<Severity, string> = { error: "✗", warning: "⚠", hint: "💡", ok: "✓" };

class NoteWidget extends WidgetType {
  constructor(
    private text: string,
    private severity: Severity,
  ) {
    super();
  }
  eq(other: NoteWidget) {
    return other.text === this.text && other.severity === this.severity;
  }
  toDOM() {
    const el = document.createElement("div");
    el.className = `cm-tutor-note cm-tutor-note-${this.severity}`;
    el.textContent = this.text;
    return el;
  }
  ignoreEvent() {
    return true;
  }
}

const RANK: Record<Severity, number> = { error: 3, warning: 2, hint: 1, ok: 0 };

function build(doc: Text, items: CodeAnnotation[]): DecorationSet {
  // One highlight + one note block per line; several notes on a line are joined.
  const byLine = new Map<number, CodeAnnotation[]>();
  for (const a of items) {
    if (a.line < 1 || a.line > doc.lines) continue;
    byLine.set(a.line, [...(byLine.get(a.line) ?? []), a]);
  }
  const ranges: Range<Decoration>[] = [];
  for (const [n, notes] of byLine) {
    const line = doc.line(n);
    const severity = notes.reduce((top, a) => (RANK[a.severity] > RANK[top] ? a.severity : top), notes[0].severity);
    ranges.push(Decoration.line({ class: `cm-tutor-line cm-tutor-line-${severity}` }).range(line.from));
    ranges.push(
      Decoration.widget({ widget: new NoteWidget(notes.map((a) => `${ICON[a.severity]} ${a.text}`).join("\n"), severity), block: true, side: 1 }).range(line.to),
    );
  }
  return Decoration.set(ranges, true);
}

/** Tutor annotations as line highlights + block notes; they follow edits and are cleared explicitly. */
export const annotationsField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    let next = deco.map(tr.changes);
    for (const e of tr.effects) {
      if (e.is(setAnnotationsEffect)) next = build(tr.state.doc, e.value);
    }
    return next;
  },
  provide: (f) => EditorView.decorations.from(f),
});

export const annotationsTheme = EditorView.baseTheme({
  ".cm-tutor-line-error": { backgroundColor: "rgba(239, 68, 68, 0.14)" },
  ".cm-tutor-line-warning": { backgroundColor: "rgba(245, 158, 11, 0.14)" },
  ".cm-tutor-line-hint": { backgroundColor: "rgba(99, 102, 241, 0.14)" },
  ".cm-tutor-line-ok": { backgroundColor: "rgba(16, 185, 129, 0.12)" },
  ".cm-tutor-note": {
    fontFamily: "ui-sans-serif, system-ui, sans-serif",
    fontSize: "12px",
    lineHeight: "1.4",
    padding: "3px 8px 3px 12px",
    margin: "2px 0 4px 0",
    borderLeft: "3px solid",
    borderRadius: "0 6px 6px 0",
    whiteSpace: "pre-wrap",
  },
  ".cm-tutor-note-error": { color: "#fecaca", borderColor: "#ef4444", backgroundColor: "rgba(239, 68, 68, 0.12)" },
  ".cm-tutor-note-warning": { color: "#fde68a", borderColor: "#f59e0b", backgroundColor: "rgba(245, 158, 11, 0.12)" },
  ".cm-tutor-note-hint": { color: "#c7d2fe", borderColor: "#6366f1", backgroundColor: "rgba(99, 102, 241, 0.12)" },
  ".cm-tutor-note-ok": { color: "#a7f3d0", borderColor: "#10b981", backgroundColor: "rgba(16, 185, 129, 0.12)" },
});

export const annotationsExtension = [annotationsField, annotationsTheme];
