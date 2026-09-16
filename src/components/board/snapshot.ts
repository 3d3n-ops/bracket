import type { Editor, TLArrowBinding } from "tldraw";
import type { CompactBoard, CompactShape } from "@/lib/board/ops";
import type { ScreenRect } from "./viewport";

const MAX_SHAPES = 150;
const strip = (id: string) => id.replace(/^shape:/, "");
const r = (n: number) => Math.round(n);


/**
 * Reduces the current page to a token-light description for the tutor.
 * `safeScreen` is the part of the canvas not covered by our floating UI (in
 * screen px); it becomes the "viewport" the tutor is told to draw inside.
 */
export function compactBoard(editor: Editor, safeScreen?: ScreenRect): CompactBoard {
  const shapes = editor.getCurrentPageShapes();
  let vp: { x: number; y: number; w: number; h: number } = editor.getViewportPageBounds();
  if (safeScreen && safeScreen.w > 200 && safeScreen.h > 200) {
    const tl = editor.screenToPage({ x: safeScreen.x, y: safeScreen.y });
    const br = editor.screenToPage({ x: safeScreen.x + safeScreen.w, y: safeScreen.y + safeScreen.h });
    vp = { x: tl.x, y: tl.y, w: br.x - tl.x, h: br.y - tl.y };
  }
  const out: CompactShape[] = [];

  for (const shape of shapes.slice(0, MAX_SHAPES)) {
    const b = editor.getShapePageBounds(shape);
    if (!b) continue;
    const text = editor.getShapeUtil(shape).getText(shape)?.trim() || undefined;
    const by = shape.meta?.by === "tutor" ? "tutor" : "user";

    const base = { id: strip(shape.id), x: r(b.x), y: r(b.y), w: r(b.w), h: r(b.h), text, by } as const;

    switch (shape.type) {
      case "geo":
        out.push({ ...base, type: "box" });
        break;
      case "text":
        out.push({ ...base, type: "text" });
        break;
      case "note":
        out.push({ ...base, type: "note" });
        break;
      case "arrow": {
        const bindings = editor.getBindingsFromShape<TLArrowBinding>(shape, "arrow");
        const from = bindings.find((x) => x.props.terminal === "start")?.toId;
        const to = bindings.find((x) => x.props.terminal === "end")?.toId;
        out.push({ ...base, type: "arrow", from: from && strip(from), to: to && strip(to) });
        break;
      }
      case "draw":
        out.push({ ...base, type: "draw", text: undefined });
        break;
      default:
        out.push({ ...base, type: "other" });
    }
  }

  return {
    shapes: out,
    total: shapes.length,
    viewport: { x: r(vp.x), y: r(vp.y), w: r(vp.w), h: r(vp.h) },
  };
}
