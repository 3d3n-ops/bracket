import { z } from "zod";

/**
 * The drawing vocabulary the tutor uses. Kept deliberately small and
 * semantic; `applyOps.ts` on the client translates these into tldraw shapes.
 *
 * Ids are plain strings (no `shape:` prefix). If an `add_*` op reuses an
 * existing id the client updates that shape instead of failing, so the tutor
 * can safely "redraw" something.
 */

export const COLORS = [
  "black",
  "grey",
  "light-violet",
  "violet",
  "blue",
  "light-blue",
  "yellow",
  "orange",
  "green",
  "light-green",
  "light-red",
  "red",
] as const;
export type BoardColor = (typeof COLORS)[number];

const id = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, "ids: letters, digits, _ or -");
const color = z.enum(COLORS);

export const addBox = z.object({
  op: z.literal("add_box"),
  id: id.optional(),
  x: z.number(),
  y: z.number(),
  w: z.number().positive().optional(),
  h: z.number().positive().optional(),
  label: z.string().max(200).optional(),
  color: color.optional(),
  geo: z.enum(["rectangle", "ellipse", "diamond", "cloud", "hexagon", "oval"]).optional(),
  fill: z.enum(["none", "semi", "solid"]).optional(),
});

export const addText = z.object({
  op: z.literal("add_text"),
  id: id.optional(),
  x: z.number(),
  y: z.number(),
  text: z.string().min(1).max(1000),
  size: z.enum(["s", "m", "l", "xl"]).optional(),
  color: color.optional(),
});

export const addNote = z.object({
  op: z.literal("add_note"),
  id: id.optional(),
  x: z.number(),
  y: z.number(),
  text: z.string().min(1).max(1000),
  color: color.optional(),
});

export const addArrow = z
  .object({
    op: z.literal("add_arrow"),
    id: id.optional(),
    /** Id of the shape the arrow starts from (preferred over `start`). */
    from: id.optional(),
    /** Id of the shape the arrow points to (preferred over `end`). */
    to: id.optional(),
    start: z.object({ x: z.number(), y: z.number() }).optional(),
    end: z.object({ x: z.number(), y: z.number() }).optional(),
    label: z.string().max(100).optional(),
    color: color.optional(),
    dashed: z.boolean().optional(),
  })
  .refine((a) => (a.from || a.start) && (a.to || a.end), {
    message: "arrow needs from|start and to|end",
  });

export const addArray = z.object({
  op: z.literal("add_array"),
  /** Base id; cells become `${id}-0`, `${id}-1`, ... */
  id: id.optional(),
  x: z.number(),
  y: z.number(),
  values: z.array(z.union([z.string(), z.number(), z.null()])).min(1).max(40),
  label: z.string().max(100).optional(),
  /** Indices to highlight (e.g. pointers). */
  highlight: z.array(z.number().int().min(0)).optional(),
  /** Optional per-index pointer labels, e.g. {0: "l", 5: "r"}. */
  pointers: z.record(z.string(), z.string().max(12)).optional(),
  cellSize: z.number().positive().optional(),
});

export const updateLabel = z.object({
  op: z.literal("update_label"),
  id,
  text: z.string().max(1000),
});

export const setColor = z.object({
  op: z.literal("set_color"),
  ids: z.array(id).min(1),
  color,
});

export const move = z.object({
  op: z.literal("move"),
  id,
  x: z.number(),
  y: z.number(),
});

export const del = z.object({
  op: z.literal("delete"),
  ids: z.array(id).min(1),
});

export const clear = z.object({ op: z.literal("clear") });

export const drawMermaid = z.object({
  op: z.literal("draw_mermaid"),
  /** Mermaid source (flowchart / sequenceDiagram / stateDiagram / mindmap). */
  source: z.string().min(1).max(8000),
  x: z.number().optional(),
  y: z.number().optional(),
});

export const boardOpSchema = z.discriminatedUnion("op", [
  addBox,
  addText,
  addNote,
  addArrow,
  addArray,
  updateLabel,
  setColor,
  move,
  del,
  clear,
  drawMermaid,
]);

export type BoardOp = z.infer<typeof boardOpSchema>;

export const boardOpsSchema = z.array(boardOpSchema).min(1).max(60);

/* ------------------------------------------------------------------ */
/* Compact snapshot sent from client → agent each turn                 */
/* ------------------------------------------------------------------ */

export type CompactShape = {
  id: string;
  type: "box" | "text" | "note" | "arrow" | "draw" | "other";
  text?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Arrow endpoints by shape id when bound. */
  from?: string;
  to?: string;
  /** Who created it, when known. */
  by?: "tutor" | "user";
};

export type CompactBoard = {
  shapes: CompactShape[];
  /** Total shapes before truncation. */
  total: number;
  /** Visible viewport in page coords, so the tutor draws where the user is looking. */
  viewport: { x: number; y: number; w: number; h: number };
};
