"use client";

import { useMemo, useState } from "react";
import type { Problem } from "@/lib/db/schema";
import { NewSessionButton } from "./NewSessionButton";

const DIFF_STYLE: Record<Problem["difficulty"], string> = {
  easy: "bg-emerald-500/15 text-emerald-300",
  medium: "bg-amber-500/15 text-amber-300",
  hard: "bg-red-500/15 text-red-300",
};

export function ProblemList({ problems, solvedIds }: { problems: Problem[]; solvedIds: string[] }) {
  const [kind, setKind] = useState<"all" | "dsa" | "system_design">("all");
  const [q, setQ] = useState("");
  const solved = useMemo(() => new Set(solvedIds), [solvedIds]);

  const filtered = useMemo(
    () =>
      problems.filter(
        (p) =>
          (kind === "all" || p.kind === kind) &&
          (!q || `${p.title} ${p.category} ${p.tags.join(" ")}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [problems, kind, q],
  );

  const groups = useMemo(() => {
    const m = new Map<string, Problem[]>();
    for (const p of filtered) m.set(p.category, [...(m.get(p.category) ?? []), p]);
    return [...m.entries()];
  }, [filtered]);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["all", "dsa", "system_design"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`rounded-full px-3 py-1 text-xs ${kind === k ? "bg-white/15 text-white" : "bg-white/5 text-zinc-400 hover:bg-white/10"}`}
          >
            {k === "all" ? "All" : k === "dsa" ? "DSA" : "System design"}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          className="ml-auto w-48 rounded-md bg-white/5 px-3 py-1 text-sm outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-indigo-400"
        />
      </div>

      {groups.length === 0 && (
        <p className="rounded-xl border border-dashed border-white/10 p-6 text-sm text-zinc-500">
          No problems yet — run <code>pnpm db:seed</code>.
        </p>
      )}

      <div className="space-y-6">
        {groups.map(([category, items]) => (
          <div key={category}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">{category}</h2>
            <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]">
              {items.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04]">
                  <span className={`w-4 text-center text-sm ${solved.has(p.id) ? "text-emerald-400" : "text-zinc-700"}`}>
                    {solved.has(p.id) ? "✓" : "○"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{p.title}</div>
                    <div className="truncate text-xs text-zinc-500">{p.tags.join(" · ")}</div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] ${DIFF_STYLE[p.difficulty]}`}>{p.difficulty}</span>
                  <NewSessionButton
                    problemId={p.id}
                    label="Start"
                    className="rounded-md bg-white/10 px-3 py-1 text-xs font-medium hover:bg-indigo-500 hover:text-white disabled:opacity-50"
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
