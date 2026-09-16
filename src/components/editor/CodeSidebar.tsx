"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/lib/store/workspace-store";
import { runCode } from "@/lib/runner/run";
import type { Language } from "@/lib/db/schema";
import { CodeEditor } from "./CodeEditor";
import { OutputPanel } from "./OutputPanel";

const MIN_W = 360;

export function CodeSidebar() {
  const open = useWorkspace((s) => s.sidebarOpen);
  const width = useWorkspace((s) => s.sidebarWidth);
  const setWidth = useWorkspace((s) => s.setSidebarWidth);
  const toggle = useWorkspace((s) => s.toggleSidebar);
  const editor = useWorkspace((s) => s.editor);
  const setCode = useWorkspace((s) => s.setCode);
  const setLanguage = useWorkspace((s) => s.setLanguage);
  const resetCode = useWorkspace((s) => s.resetCode);
  const problem = useWorkspace((s) => s.problem);
  const session = useWorkspace((s) => s.session);
  const running = useWorkspace((s) => s.running);
  const setRunning = useWorkspace((s) => s.setRunning);
  const setLastRun = useWorkspace((s) => s.setLastRun);
  const [status, setStatus] = useState<string | null>(null);
  const dragging = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Default to half the screen the first time it opens.
  useEffect(() => {
    if (open && width === 0) setWidth(Math.max(MIN_W, Math.round(window.innerWidth / 2)));
  }, [open, width, setWidth]);

  // Persist editor contents (debounced).
  useEffect(() => {
    if (!session) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: editor }),
        keepalive: true,
      });
    }, 1200);
  }, [editor, session]);

  const run = useCallback(async () => {
    if (running) return;
    setRunning(true);
    setStatus(null);
    const result = await runCode(
      {
        language: editor.language,
        source: editor.source,
        entryFn: problem?.entryFn,
        io: problem?.io,
        tests: problem?.tests ?? [],
      },
      setStatus,
    );
    setStatus(null);
    setLastRun(result);
    setRunning(false);
    if (session && problem && result.tests.length) {
      void fetch("/api/attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          problemId: problem.id,
          language: editor.language,
          source: editor.source,
          passed: result.tests.filter((t) => t.passed).length,
          total: result.tests.length,
        }),
      });
    }
  }, [running, editor, problem, session, setRunning, setLastRun]);

  // ⌘↵ runs, ⌘B toggles the sidebar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        void run();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, toggle]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    setWidth(Math.max(MIN_W, Math.min(window.innerWidth - 240, window.innerWidth - e.clientX)));
  };
  const onPointerUp = () => (dragging.current = false);

  return (
    <aside
      className="fixed right-0 top-0 z-10 flex h-full flex-col border-l border-white/10 bg-zinc-950/95 text-zinc-100 shadow-2xl backdrop-blur transition-[width] duration-200"
      style={{ width: open ? width : 0 }}
      aria-hidden={!open}
    >
      {open && (
        <>
          <div
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-indigo-400/50"
          />
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
            <select
              value={editor.language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className="rounded-md bg-white/10 px-2 py-1 text-xs outline-none"
            >
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
            </select>
            {problem?.entryFn && (
              <span className="text-xs text-zinc-500">
                entry: <code className="text-zinc-300">{editor.language === "python" ? snake(problem.entryFn) : problem.entryFn}</code>
              </span>
            )}
            <div className="flex-1" />
            <button
              onClick={resetCode}
              className="rounded-md px-2 py-1 text-xs text-zinc-400 hover:bg-white/10"
              title="Reset to starter code"
            >
              Reset
            </button>
            <button
              onClick={run}
              disabled={running}
              className="rounded-md bg-emerald-500 px-3 py-1 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
              title="Run (⌘↵)"
            >
              {running ? "Running…" : "▶ Run"}
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <CodeEditor language={editor.language} value={editor.source} onChange={(source) => setCode({ source })} />
          </div>
          <OutputPanel status={status} />
        </>
      )}
    </aside>
  );
}

function snake(name: string) {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}
