import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { attempts, memories, problems, sessions } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth/anon";
import { ProblemList } from "@/components/dashboard/ProblemList";
import { RecentSessions } from "@/components/dashboard/RecentSessions";
import { NewSessionButton } from "@/components/dashboard/NewSessionButton";
import { LearnBox } from "@/components/dashboard/LearnBox";
import { LeetCodePanel } from "@/components/dashboard/LeetCodePanel";

export default async function DashboardPage() {
  const userId = await getCurrentUserId();

  const [allProblems, recent, solved, memoryCount] = await Promise.all([
    db
      .select()
      .from(problems)
      .where(eq(problems.source, "seed"))
      .orderBy(
        problems.kind,
        problems.category,
        sql`case ${problems.difficulty} when 'easy' then 0 when 'medium' then 1 else 2 end`,
        problems.title,
      ),
    db
      .select({
        id: sessions.id,
        title: sessions.title,
        status: sessions.status,
        mode: sessions.mode,
        updatedAt: sessions.updatedAt,
        summary: sessions.summary,
        problemKind: problems.kind,
        difficulty: problems.difficulty,
      })
      .from(sessions)
      .leftJoin(problems, eq(sessions.problemId, problems.id))
      .where(eq(sessions.userId, userId))
      .orderBy(desc(sessions.updatedAt))
      .limit(8),
    db
      .select({ problemId: attempts.problemId })
      .from(attempts)
      .innerJoin(sessions, eq(attempts.sessionId, sessions.id))
      .where(sql`${sessions.userId} = ${userId} and ${attempts.allPassed}`)
      .groupBy(attempts.problemId),
    db.$count(memories, eq(memories.userId, userId)),
  ]);

  const solvedIds = new Set(solved.map((s) => s.problemId).filter(Boolean) as string[]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10 text-zinc-100">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            <span className="text-indigo-400">[</span>bracket<span className="text-indigo-400">]</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Interview practice on a whiteboard, with a tutor who draws, listens, and remembers.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <span className="text-zinc-400">solved</span> <b>{solvedIds.size}</b>
            <span className="mx-2 text-zinc-600">·</span>
            <span className="text-zinc-400">memories</span> <b>{memoryCount}</b>
          </div>
          <NewSessionButton />
        </div>
      </header>

      <div className="mb-10 grid gap-4 lg:grid-cols-2">
        <LearnBox />
        <LeetCodePanel />
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <ProblemList problems={allProblems} solvedIds={[...solvedIds]} />
        <RecentSessions sessions={recent} />
      </div>
    </main>
  );
}
