"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Problem } from "@/lib/db/schema";

/** Small popover showing the problem statement. */
export function ProblemDrawer({ problem }: { problem: Problem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="rounded-md px-2 py-0.5 text-xs text-zinc-300 hover:bg-white/10">
        {open ? "Hide problem" : "Problem"}
      </button>
      {open && (
        <div className="absolute left-0 top-8 z-40 max-h-[70vh] w-[420px] overflow-y-auto rounded-xl border border-white/10 bg-zinc-900/95 p-4 text-sm shadow-2xl backdrop-blur-xl">
          <div className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
            {problem.category} · {problem.tags.join(", ")}
          </div>
          <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-black/40">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{problem.promptMd}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
