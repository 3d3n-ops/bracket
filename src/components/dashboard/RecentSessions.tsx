import Link from "next/link";

type Row = {
  id: string;
  title: string;
  status: "active" | "closed";
  mode: "problem" | "learn" | "freestyle";
  updatedAt: Date;
  summary: string | null;
  problemKind: "dsa" | "system_design" | null;
  difficulty: "easy" | "medium" | "hard" | null;
};

export function RecentSessions({ sessions }: { sessions: Row[] }) {
  return (
    <aside>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Recent sessions</h2>
      {sessions.length === 0 ? (
        <p className="text-sm text-zinc-500">Nothing yet. Start a problem or a freestyle session.</p>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link
                href={`/session/${s.id}`}
                className="block rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.06]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{s.title}</span>
                  <span className={`text-[11px] ${s.status === "active" ? "text-emerald-400" : "text-zinc-500"}`}>
                    {s.status}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-zinc-500">
                  {s.mode === "learn" ? "Learn" : s.problemKind === "system_design" ? "System design" : s.problemKind === "dsa" ? "DSA" : "Freestyle"} ·{" "}
                  {new Date(s.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </div>
                {s.summary && <p className="mt-1 line-clamp-2 text-xs text-zinc-400">{s.summary}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
