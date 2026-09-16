"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWorkspace } from "@/lib/store/workspace-store";
import { ProblemDrawer } from "./ProblemDrawer";

const pill =
  "pointer-events-auto flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-1.5 text-sm text-zinc-100 shadow-lg backdrop-blur-xl";

/** Rendered in tldraw's top-left (MenuPanel) slot. */
export function LeftControls() {
  const problem = useWorkspace((s) => s.problem);
  const session = useWorkspace((s) => s.session);
  if (!session) return null;
  return (
    <div className="m-2">
      <div className={pill}>
        <Link href="/" className="text-zinc-400 hover:text-white" title="Dashboard">
          ←
        </Link>
        <span className="whitespace-nowrap font-semibold">
          {problem ? problem.title : session.mode === "learn" ? (session.topic ? `Learn: ${session.topic}` : "Surprise me") : session.title}
        </span>
        {problem?.url && (
          <a href={problem.url} target="_blank" rel="noreferrer" className="text-[11px] text-amber-300/80 hover:text-amber-200" title="Open on LeetCode">
            LC ↗
          </a>
        )}
        {problem && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              problem.difficulty === "easy"
                ? "bg-emerald-500/20 text-emerald-300"
                : problem.difficulty === "medium"
                  ? "bg-amber-500/20 text-amber-300"
                  : "bg-red-500/20 text-red-300"
            }`}
          >
            {problem.difficulty}
          </span>
        )}
        {problem && <ProblemDrawer problem={problem} />}
      </div>
    </div>
  );
}

/** Rendered in tldraw's top-right (SharePanel) slot. */
export function RightControls() {
  const session = useWorkspace((s) => s.session);
  const sidebarOpen = useWorkspace((s) => s.sidebarOpen);
  const toggleSidebar = useWorkspace((s) => s.toggleSidebar);
  const chatVisible = useWorkspace((s) => s.chatVisible);
  const toggleChat = useWorkspace((s) => s.toggleChat);
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  if (!session) return null;

  const close = async () => {
    setClosing(true);
    try {
      await fetch(`/api/sessions/${session.id}/close`, { method: "POST" });
    } finally {
      router.push("/");
    }
  };

  return (
    <div className="m-2">
      <div className={`${pill} !px-2 text-xs`}>
        {!chatVisible && (
          <button onClick={() => toggleChat(true)} className="rounded-md px-2 py-1 hover:bg-white/10">
            Tutor
          </button>
        )}
        <button onClick={() => toggleSidebar()} className="rounded-md px-2 py-1 hover:bg-white/10" title="Toggle code editor (⌘B)">
          {sidebarOpen ? "Hide code" : "Code"}
        </button>
        <button
          onClick={close}
          disabled={closing}
          className="rounded-md px-2 py-1 text-zinc-300 hover:bg-white/10 disabled:opacity-50"
          title="End session and save what the tutor learned"
        >
          {closing ? "Saving…" : "End session"}
        </button>
      </div>
    </div>
  );
}
