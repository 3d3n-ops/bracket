"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const SUGGESTIONS = ["Big-O intuition", "Sliding window", "Dijkstra", "Consistent hashing", "Tries", "Union-Find", "CAP theorem"];

/** "Learn anything": a topic-driven session where the tutor opens the conversation. */
export function LearnBox() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState<"topic" | "surprise" | null>(null);

  const start = async (t: string | null) => {
    setBusy(t === null ? "surprise" : "topic");
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: "learn", topic: t }),
      });
      const { id } = (await res.json()) as { id: string };
      router.push(`/session/${id}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="rounded-2xl border border-indigo-400/20 bg-gradient-to-br from-indigo-500/10 to-transparent p-5">
      <h2 className="text-base font-semibold">Learn anything</h2>
      <p className="mt-1 text-sm text-zinc-400">
        Name a topic — the tutor gauges what you know, teaches it on the board, then hands you a real exercise.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (topic.trim()) void start(topic.trim());
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. how does a B-tree work? / dynamic programming from scratch"
          className="flex-1 rounded-lg bg-black/30 px-3 py-2 text-sm outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-indigo-400"
        />
        <button
          type="submit"
          disabled={!topic.trim() || !!busy}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-40"
        >
          {busy === "topic" ? "Opening…" : "Teach me"}
        </button>
        <button
          type="button"
          onClick={() => start(null)}
          disabled={!!busy}
          className="rounded-lg border border-white/15 px-4 py-2 text-sm text-zinc-200 hover:bg-white/10 disabled:opacity-40"
          title="The tutor picks a topic from your weak spots or the LeetCode daily"
        >
          {busy === "surprise" ? "Picking…" : "Surprise me"}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setTopic(s)}
            className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
          >
            {s}
          </button>
        ))}
      </div>
    </section>
  );
}
