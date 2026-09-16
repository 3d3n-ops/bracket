"use client";

import { useCallback, useRef } from "react";
import { readEvents } from "@/lib/agent/events";
import { useWorkspace } from "@/lib/store/workspace-store";
import { applyBoardOps } from "@/components/board/applyOps";
import { compactBoard } from "@/components/board/snapshot";
import { safeDrawingRect } from "@/components/board/viewport";
import { useTtsQueue } from "@/lib/voice/useVoice";

const TOOL_LABELS: Record<string, string> = {
  draw_on_board: "drawing on the board",
  set_editor_code: "writing in the editor",
  set_exercise: "creating an exercise",
  run_code: "running code",
  set_tests: "updating tests",
  leetcode_search: "searching LeetCode",
  leetcode_import: "importing from LeetCode",
  leetcode_daily: "checking the daily challenge",
  save_memory: "taking a note",
};

/**
 * Sends a user turn to the tutor and streams the reply into the store,
 * applying board / editor side effects as they arrive.
 */
export function useChatStream() {
  const abortRef = useRef<AbortController | null>(null);
  const tts = useTtsQueue();

  const send = useCallback(
    async (text: string, opts: { kickoff?: boolean } = {}) => {
      const s = useWorkspace.getState();
      if (!s.session || s.streaming || (!opts.kickoff && !text.trim())) return;

      const assistantId = crypto.randomUUID();
      if (!opts.kickoff) s.pushMessage({ id: crypto.randomUUID(), role: "user", text });
      s.pushMessage({ id: assistantId, role: "assistant", text: "", streaming: true, tools: [] });
      s.setStreaming(true);

      const editor = s.editorRef;
      const board = editor ? compactBoard(editor, safeDrawingRect(s)) : null;
      const controller = new AbortController();
      abortRef.current = controller;

      let sentence = "";
      const flushSentence = (force = false) => {
        if (!useWorkspace.getState().ttsEnabled) return;
        // Speak at sentence boundaries so audio starts before the reply finishes.
        const m = force ? null : sentence.match(/^([\s\S]*?[.!?])(\s+|$)/);
        const chunk = force ? sentence : m?.[1];
        if (chunk && chunk.trim()) {
          tts.enqueue(chunk.trim());
          sentence = force ? "" : sentence.slice(m![0].length);
        }
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            sessionId: s.session.id,
            text,
            kickoff: opts.kickoff,
            board,
            code: s.editor,
            lastRun: s.lastRun,
          }),
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Chat failed (${res.status}): ${await res.text()}`);

        for await (const ev of readEvents(res)) {
          const st = useWorkspace.getState();
          switch (ev.type) {
            case "text":
              st.updateMessage(assistantId, (m) => ({ text: m.text + ev.delta }));
              sentence += ev.delta;
              flushSentence();
              break;
            case "tool_start":
              st.updateMessage(assistantId, (m) => ({
                tools: [...(m.tools ?? []), TOOL_LABELS[ev.name] ?? ev.name],
              }));
              break;
            case "board_ops":
              if (st.editorRef) await applyBoardOps(st.editorRef, ev.ops, safeDrawingRect(st));
              break;
            case "editor_set":
              st.setCode(ev.editor);
              st.toggleSidebar(true);
              break;
            case "exercise_set":
              st.setProblem(ev.problem, ev.language);
              break;
            case "error":
              st.updateMessage(assistantId, { error: ev.message });
              break;
            case "done":
              break;
          }
        }
        flushSentence(true);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          useWorkspace.getState().updateMessage(assistantId, { error: (e as Error).message });
        }
      } finally {
        useWorkspace.getState().updateMessage(assistantId, { streaming: false });
        useWorkspace.getState().setStreaming(false);
        abortRef.current = null;
      }
    },
    [tts],
  );

  const stop = useCallback(() => abortRef.current?.abort(), []);

  return { send, stop };
}
