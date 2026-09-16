"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { LcSummary } from "@/lib/leetcode/client";

const DIFF_STYLE: Record<string, string> = {
  Easy: "bg-emerald-500/15 text-emerald-300",
  Medium: "bg-amber-500/15 text-amber-300",
  Hard: "bg-red-500/15 text-red-300",
};

/** Search LeetCode and start a session on any free problem, or on today's daily challenge. */
export function LeetCodePanel() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [results, setResults] = useState<LcSummary[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [daily, setDaily] = useState<{ slug: string; title: string; difficulty: string } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/leetcode/daily")
      .then((r) => r.json())
      .then((d) => d.slug && setDaily(d))
      .catch(() => {});
  }, []);

  const search = async () => {
    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (difficulty) params.set("difficulty", difficulty);
      const r = (await (await fetch(`/api/leetcode/search?${params}`)).json()) as { total: number; problems: LcSummary[]; error?: string };
      if (r.error) throw new Error(r.error);
      setResults(r.problems);
      setTotal(r.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSearching(false);
    }
  };

  const open = async (slug: string) => {
    setOpening(slug);
    setError(null);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leetcodeSlug: slug }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? "Could not import");
      router.push(`/session/${data.id}`);
    } catch (e) {
      setError((e as Error).message);
      setOpening(null);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">LeetCode</h2>
        {daily && (
          <button
            onClick={() => open(daily.slug)}
            disabled={!!opening}
            className="rounded-lg bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-200 hover:bg-amber-500/30 disabled:opacity-50"
            title={daily.title}
          >
            {opening === daily.slug ? "Importing…" : `Daily: ${daily.title} · ${daily.difficulty}`}
          </button>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search problems… (title keywords)"
          className="flex-1 rounded-lg bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-indigo-400"
        />
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="rounded-lg bg-white/10 px-2 py-2 text-xs outline-none">
          <option value="">Any</option>
          <option value="EASY">Easy</option>
          <option value="MEDIUM">Medium</option>
          <option value="HARD">Hard</option>
        </select>
        <button type="submit" disabled={searching} className="rounded-lg bg-white/10 px-4 py-2 text-sm hover:bg-white/15 disabled:opacity-50">
          {searching ? "…" : "Search"}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
      {total !== null && (
        <ul className="mt-3 divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10">
          {results.length === 0 && <li className="px-3 py-2 text-sm text-zinc-500">No matches.</li>}
          {results.map((p) => (
            <li key={p.slug} className="flex items-center gap-3 px-3 py-2 hover:bg-white/[0.04]">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">
                  <span className="text-zinc-500">{p.id}.</span> {p.title}
                </div>
                <div className="truncate text-xs text-zinc-500">
                  {p.tags.slice(0, 4).join(" · ")} · {p.acRate}% acc
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${DIFF_STYLE[p.difficulty]}`}>{p.difficulty}</span>
              {p.paidOnly ? (
                <span className="text-[11px] text-zinc-500">premium</span>
              ) : (
                <button
                  onClick={() => open(p.slug)}
                  disabled={!!opening}
                  className="rounded-md bg-white/10 px-3 py-1 text-xs font-medium hover:bg-indigo-500 hover:text-white disabled:opacity-50"
                >
                  {opening === p.slug ? "Importing…" : "Start"}
                </button>
              )}
            </li>
          ))}
          {total > results.length && <li className="px-3 py-1.5 text-xs text-zinc-500">{total} matches — refine your search.</li>}
        </ul>
      )}
    </section>
  );
}
