"use client";

import { useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useWorkspace } from "@/lib/store/workspace-store";

const TOOL_LABELS: Record<string, string> = {
  draw_on_board: "drew on the board",
  set_editor_code: "wrote in the editor",
  set_exercise: "created an exercise",
  edit_code: "edited the code",
  run_code: "ran code",
  set_tests: "updated tests",
  leetcode_search: "searched LeetCode",
  leetcode_import: "imported from LeetCode",
  leetcode_daily: "checked the daily challenge",
  save_memory: "took a note",
};

export function MessageList() {
  const messages = useWorkspace((s) => s.messages);
  const problem = useWorkspace((s) => s.problem);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  return (
    <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-[13.5px] leading-relaxed">
      {messages.length === 0 && (
        <div className="rounded-xl bg-white/5 p-3 text-zinc-300">
          {problem ? (
            <>
              Hi! We&apos;re working on <b>{problem.title}</b>. Tell me how you&apos;d approach it, ask for a hint,
              or say &ldquo;draw it&rdquo; and I&apos;ll sketch on the board.
            </>
          ) : (
            <>Ask me anything about DSA or system design — I can draw on the board, write code in the editor, and pull in LeetCode problems.</>
          )}
        </div>
      )}

      {messages.map((m) => (
        <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
          <div
            className={
              m.role === "user"
                ? "max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-500/80 px-3 py-2 text-white"
                : "max-w-[92%] rounded-2xl rounded-bl-sm bg-white/5 px-3 py-2"
            }
          >
            {m.tools && m.tools.length > 0 && (
              <div className="mb-1 flex flex-wrap gap-1">
                {m.tools.map((t, i) => (
                  <span key={i} className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] text-emerald-300">
                    {TOOL_LABELS[t] ?? t}
                  </span>
                ))}
              </div>
            )}
            {m.role === "user" ? (
              <p className="whitespace-pre-wrap">{m.text}</p>
            ) : (
              <div className="prose prose-invert prose-sm max-w-none prose-p:my-1.5 prose-pre:my-2 prose-pre:bg-black/40 prose-code:text-emerald-200 prose-headings:my-2">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                {m.streaming && !m.text && <span className="inline-block animate-pulse text-zinc-400">thinking…</span>}
              </div>
            )}
            {m.error && <p className="mt-1 text-xs text-red-300">{m.error}</p>}
          </div>
        </div>
      ))}
      <div ref={bottom} />
    </div>
  );
}
