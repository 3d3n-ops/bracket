"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { Problem, Session } from "@/lib/db/schema";
import { useWorkspace, type ChatMessage, type VoiceProvider } from "@/lib/store/workspace-store";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { CodeSidebar } from "@/components/editor/CodeSidebar";
import { useChatStream } from "@/components/chat/useChatStream";

// tldraw touches `window` at import time.
const Board = dynamic(() => import("@/components/board/Board").then((m) => m.Board), { ssr: false });

export function Workspace({
  session,
  problem,
  messages,
  voice,
}: {
  session: Session;
  problem: Problem | null;
  messages: ChatMessage[];
  voice: VoiceProvider;
}) {
  const init = useWorkspace((s) => s.init);
  const sidebarOpen = useWorkspace((s) => s.sidebarOpen);
  const sidebarWidth = useWorkspace((s) => s.sidebarWidth);
  const { send } = useChatStream();
  const kicked = useRef(false);

  useEffect(() => {
    init(session, problem, messages, voice);
  }, [init, session, problem, messages, voice]);

  // Learn / freestyle sessions: the tutor speaks first.
  useEffect(() => {
    if (kicked.current || session.mode === "problem" || messages.length > 0) return;
    // Let the board mount so the kickoff turn carries a viewport. The guard is
    // set inside the timer so StrictMode's double effect run doesn't swallow it.
    const t = setTimeout(() => {
      if (kicked.current) return;
      kicked.current = true;
      void send("", { kickoff: true });
    }, 600);
    return () => clearTimeout(t);
  }, [session.mode, messages.length, send]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-zinc-950">
      <div className="absolute inset-0" style={{ right: sidebarOpen ? sidebarWidth : 0 }}>
        <Board sessionId={session.id} initialSnapshot={session.boardSnapshot} />
      </div>
      <ChatPanel />
      <CodeSidebar />
    </div>
  );
}
