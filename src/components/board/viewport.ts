import type { Editor } from "tldraw";
import type { useWorkspace } from "@/lib/store/workspace-store";

export type ScreenRect = { x: number; y: number; w: number; h: number };

/** Screen-space area of the canvas not hidden by the chat panel, top bar, or sidebar. */
export function safeDrawingRect(s: ReturnType<typeof useWorkspace.getState>): ScreenRect {
  const canvasW = window.innerWidth - (s.sidebarOpen ? s.sidebarWidth : 0);
  const top = 72;
  const bottom = window.innerHeight - 90;
  const pad = 24;
  if (!s.chatVisible) return { x: pad, y: top, w: canvasW - 2 * pad, h: bottom - top };
  const p = s.chatPanel;
  const rightOfPanel = { x: p.x + p.w + pad, y: top, w: canvasW - (p.x + p.w + pad) - pad, h: bottom - top };
  const leftOfPanel = { x: pad, y: top, w: p.x - 2 * pad, h: bottom - top };
  return rightOfPanel.w >= leftOfPanel.w ? rightOfPanel : leftOfPanel;
}

/** Moves/zooms the camera so `bounds` (page coords) fits inside `safe` (screen coords). */
export function fitBoundsInRect(
  editor: Editor,
  bounds: { x: number; y: number; w: number; h: number },
  safe: ScreenRect,
  pad = 60,
) {
  const z = Math.min(safe.w / (bounds.w + 2 * pad), safe.h / (bounds.h + 2 * pad), 1);
  const cx = safe.x + safe.w / 2;
  const cy = safe.y + safe.h / 2;
  editor.setCamera(
    { x: cx / z - (bounds.x + bounds.w / 2), y: cy / z - (bounds.y + bounds.h / 2), z },
    { animation: { duration: 350 } },
  );
}
