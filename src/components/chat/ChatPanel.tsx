"use client";

import { useCallback, useEffect, useRef } from "react";
import { useWorkspace } from "@/lib/store/workspace-store";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";

const MIN_W = 320;
const MIN_H = 320;

/** Floating, translucent, draggable + resizable chat window over the canvas. */
export function ChatPanel() {
  const panel = useWorkspace((s) => s.chatPanel);
  const setPanel = useWorkspace((s) => s.setChatPanel);
  const visible = useWorkspace((s) => s.chatVisible);
  const toggleChat = useWorkspace((s) => s.toggleChat);
  const sidebarWidth = useWorkspace((s) => s.sidebarWidth);
  const sidebarOpen = useWorkspace((s) => s.sidebarOpen);
  const drag = useRef<{ mode: "move" | "resize"; sx: number; sy: number; start: typeof panel } | null>(null);

  const onPointerDown = useCallback(
    (mode: "move" | "resize") => (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      drag.current = { mode, sx: e.clientX, sy: e.clientY, start: useWorkspace.getState().chatPanel };
    },
    [],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      if (d.mode === "move") {
        const maxX = window.innerWidth - (sidebarOpen ? sidebarWidth : 0) - d.start.w;
        setPanel({
          x: Math.max(0, Math.min(maxX, d.start.x + dx)),
          y: Math.max(48, Math.min(window.innerHeight - 60, d.start.y + dy)),
        });
      } else {
        setPanel({ w: Math.max(MIN_W, d.start.w + dx), h: Math.max(MIN_H, d.start.h + dy) });
      }
    },
    [setPanel, sidebarOpen, sidebarWidth],
  );

  const onPointerUp = useCallback(() => (drag.current = null), []);

  // Keep the panel on screen when the sidebar opens.
  useEffect(() => {
    if (!sidebarOpen) return;
    const maxX = window.innerWidth - sidebarWidth - panel.w - 8;
    if (panel.x > maxX) setPanel({ x: Math.max(8, maxX) });
  }, [sidebarOpen, sidebarWidth, panel.w, panel.x, setPanel]);

  if (!visible) return null;

  return (
    <div
      className="fixed z-20 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/70 text-zinc-100 shadow-2xl backdrop-blur-xl"
      style={{ left: panel.x, top: panel.y, width: panel.w, height: panel.h }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <header
        onPointerDown={onPointerDown("move")}
        className="flex cursor-grab select-none items-center justify-between border-b border-white/10 bg-white/5 px-3 py-2 active:cursor-grabbing"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          Tutor
        </div>
        <button
          onClick={() => toggleChat(false)}
          onPointerDown={(e) => e.stopPropagation()}
          className="rounded px-2 text-zinc-400 hover:bg-white/10 hover:text-white"
          aria-label="Minimize chat"
        >
          –
        </button>
      </header>

      <MessageList />
      <Composer />

      <div
        onPointerDown={onPointerDown("resize")}
        className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
        aria-hidden
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4 text-zinc-500">
          <path d="M14 2L2 14M14 8l-6 6M14 14h0" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
}
