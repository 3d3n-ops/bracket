import {
  Box,
  createShapeId,
  toRichText,
  type Editor,
  type TLArrowShape,
  type TLGeoShape,
  type TLNoteShape,
  type TLShapeId,
  type TLShapePartial,
  type TLTextShape,
} from "tldraw";
import type { BoardOp } from "@/lib/board/ops";
import { fitBoundsInRect, type ScreenRect } from "./viewport";

const TUTOR_META = { by: "tutor" } as const;

const sid = (id: string): TLShapeId => createShapeId(id);
const rand = () => Math.random().toString(36).slice(2, 8);

function center(editor: Editor, id: TLShapeId) {
  const b = editor.getShapePageBounds(id);
  return b ? { x: b.midX, y: b.midY } : null;
}

/**
 * Applies tutor-issued ops to the editor. Most ops are batched into a single
 * undoable transaction; `draw_mermaid` is async and runs afterwards.
 */
export async function applyBoardOps(editor: Editor, ops: BoardOp[], safe?: ScreenRect) {
  const mermaids: Extract<BoardOp, { op: "draw_mermaid" }>[] = [];
  const before = new Set(editor.getCurrentPageShapeIds());

  editor.run(() => {
    for (const op of ops) {
      switch (op.op) {
        case "add_box": {
          const id = sid(op.id ?? `box-${rand()}`);
          const props: Partial<TLGeoShape["props"]> = {
            geo: op.geo ?? "rectangle",
            w: op.w ?? 160,
            h: op.h ?? 80,
            color: op.color ?? "black",
            fill: op.fill ?? "semi",
            richText: toRichText(op.label ?? ""),
            size: "m",
            font: "draw",
          };
          if (editor.getShape(id)) {
            editor.updateShape({ id, type: "geo", x: op.x, y: op.y, props });
          } else {
            editor.createShape<TLGeoShape>({ id, type: "geo", x: op.x, y: op.y, props, meta: TUTOR_META });
          }
          break;
        }
        case "add_text": {
          const id = sid(op.id ?? `text-${rand()}`);
          const props: Partial<TLTextShape["props"]> = {
            richText: toRichText(op.text),
            size: op.size ?? "m",
            color: op.color ?? "black",
            autoSize: true,
            font: "draw",
          };
          if (editor.getShape(id)) {
            editor.updateShape({ id, type: "text", x: op.x, y: op.y, props });
          } else {
            editor.createShape<TLTextShape>({ id, type: "text", x: op.x, y: op.y, props, meta: TUTOR_META });
          }
          break;
        }
        case "add_note": {
          const id = sid(op.id ?? `note-${rand()}`);
          const props: Partial<TLNoteShape["props"]> = {
            richText: toRichText(op.text),
            color: op.color ?? "yellow",
            size: "s",
            font: "draw",
          };
          if (editor.getShape(id)) {
            editor.updateShape({ id, type: "note", x: op.x, y: op.y, props });
          } else {
            editor.createShape<TLNoteShape>({ id, type: "note", x: op.x, y: op.y, props, meta: TUTOR_META });
          }
          break;
        }
        case "add_arrow": {
          const id = sid(op.id ?? `arrow-${rand()}`);
          const fromId = op.from ? sid(op.from) : null;
          const toId = op.to ? sid(op.to) : null;
          const start = (fromId && center(editor, fromId)) ?? op.start ?? { x: 0, y: 0 };
          const end = (toId && center(editor, toId)) ?? op.end ?? { x: start.x + 100, y: start.y };

          if (editor.getShape(id)) editor.deleteShape(id);
          editor.createShape<TLArrowShape>({
            id,
            type: "arrow",
            x: 0,
            y: 0,
            meta: TUTOR_META,
            props: {
              kind: "arc",
              start,
              end,
              bend: 0,
              color: op.color ?? "black",
              dash: op.dashed ? "dashed" : "draw",
              size: "m",
              arrowheadStart: "none",
              arrowheadEnd: "arrow",
              richText: toRichText(op.label ?? ""),
              font: "draw",
            },
          });
          const bind = (terminal: "start" | "end", target: TLShapeId | null) => {
            if (!target || !editor.getShape(target)) return;
            editor.createBinding({
              type: "arrow",
              fromId: id,
              toId: target,
              props: {
                terminal,
                normalizedAnchor: { x: 0.5, y: 0.5 },
                isPrecise: false,
                isExact: false,
                snap: "none",
              },
            });
          };
          bind("start", fromId);
          bind("end", toId);
          break;
        }
        case "add_array": {
          const base = op.id ?? `arr-${rand()}`;
          const cell = op.cellSize ?? 56;
          const highlight = new Set(op.highlight ?? []);
          // Remove a previous rendering of the same array so re-draws are clean.
          const stale = editor
            .getCurrentPageShapes()
            .filter((s) => s.id.startsWith(`shape:${base}-`))
            .map((s) => s.id);
          if (stale.length) editor.deleteShapes(stale);

          if (op.label) {
            editor.createShape<TLTextShape>({
              id: sid(`${base}-label`),
              type: "text",
              x: op.x,
              y: op.y - (op.pointers && Object.keys(op.pointers).length ? 60 : 34),
              meta: TUTOR_META,
              props: { richText: toRichText(op.label), size: "s", color: "grey", autoSize: true, font: "draw" },
            });
          }
          op.values.forEach((v, i) => {
            const x = op.x + i * cell;
            editor.createShape<TLGeoShape>({
              id: sid(`${base}-${i}`),
              type: "geo",
              x,
              y: op.y,
              meta: TUTOR_META,
              props: {
                geo: "rectangle",
                w: cell,
                h: cell,
                color: highlight.has(i) ? "orange" : "black",
                fill: highlight.has(i) ? "semi" : "none",
                richText: toRichText(v === null ? "" : String(v)),
                size: "s",
                font: "mono",
              },
            });
            editor.createShape<TLTextShape>({
              id: sid(`${base}-idx-${i}`),
              type: "text",
              x: x + cell / 2 - 8,
              y: op.y + cell + 4,
              meta: TUTOR_META,
              props: { richText: toRichText(String(i)), size: "s", color: "grey", autoSize: true, font: "mono" },
            });
            const p = op.pointers?.[String(i)];
            if (p) {
              editor.createShape<TLTextShape>({
                id: sid(`${base}-ptr-${i}`),
                type: "text",
                x: x + cell / 2 - 8,
                y: op.y - 26,
                meta: TUTOR_META,
                props: { richText: toRichText(p), size: "s", color: "red", autoSize: true, font: "mono" },
              });
            }
          });
          break;
        }
        case "update_label": {
          const id = sid(op.id);
          const shape = editor.getShape(id);
          if (!shape) break;
          editor.updateShape({ id, type: shape.type, props: { richText: toRichText(op.text) } } as TLShapePartial);
          break;
        }
        case "set_color": {
          for (const raw of op.ids) {
            const id = sid(raw);
            const shape = editor.getShape(id);
            if (!shape) continue;
            editor.updateShape({ id, type: shape.type, props: { color: op.color } } as TLShapePartial);
          }
          break;
        }
        case "move": {
          const id = sid(op.id);
          const shape = editor.getShape(id);
          if (shape) editor.updateShape({ id, type: shape.type, x: op.x, y: op.y });
          break;
        }
        case "delete": {
          const ids = op.ids.map(sid).filter((i) => editor.getShape(i));
          if (ids.length) editor.deleteShapes(ids);
          break;
        }
        case "clear": {
          const ids = editor.getCurrentPageShapes().map((s) => s.id);
          if (ids.length) editor.deleteShapes(ids);
          break;
        }
        case "draw_mermaid":
          mermaids.push(op);
          break;
      }
    }
  });

  for (const m of mermaids) {
    const { createMermaidDiagram } = await import("@tldraw/mermaid");
    const vp = editor.getViewportPageBounds();
    await createMermaidDiagram(editor, m.source, {
      blueprintRender: { position: { x: m.x ?? vp.x + 80, y: m.y ?? vp.y + 80 }, centerOnPosition: false },
      async onUnsupportedDiagram(svgString) {
        await editor.putExternalContent({ type: "svg-text", text: svgString });
      },
    });
  }

  // Bring newly drawn content into view if it spills outside the viewport.
  const created = [...editor.getCurrentPageShapeIds()].filter((id) => !before.has(id));
  if (created.length) {
    editor.setSelectedShapes([]);
    const bounds = created
      .map((id) => editor.getShapePageBounds(id))
      .filter((b): b is NonNullable<typeof b> => !!b)
      .reduce((acc, b) => (acc ? acc.union(b) : b.clone()), null as Box | null);
    if (!bounds) return;
    const tl = safe ? editor.screenToPage({ x: safe.x, y: safe.y }) : null;
    const br = safe ? editor.screenToPage({ x: safe.x + safe.w, y: safe.y + safe.h }) : null;
    const visible = tl && br ? new Box(tl.x, tl.y, br.x - tl.x, br.y - tl.y) : editor.getViewportPageBounds();
    if (!visible.contains(bounds)) {
      if (safe) fitBoundsInRect(editor, bounds, safe);
      else editor.zoomToBounds(bounds, { inset: 80, animation: { duration: 350 } });
    }
  }
}
