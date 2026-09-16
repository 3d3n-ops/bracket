import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { problems, sessions } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth/anon";
import { extractSessionMemories } from "@/lib/memory/extract";

export const maxDuration = 120;

/** Ends a session: extracts memories + summary, marks it closed. */
export async function POST(_req: Request, ctx: RouteContext<"/api/sessions/[id]/close">) {
  const { id } = await ctx.params;
  const userId = await getCurrentUserId();
  const [s] = await db.select().from(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, userId))).limit(1);
  if (!s) return Response.json({ error: "Not found" }, { status: 404 });

  const problem = s.problemId ? (await db.select().from(problems).where(eq(problems.id, s.problemId)).limit(1))[0] ?? null : null;

  try {
    const r = await extractSessionMemories(id, userId, problem);
    return Response.json({ ok: true, ...r });
  } catch (e) {
    console.error("[close] extraction failed", e);
    await db.update(sessions).set({ status: "closed", updatedAt: new Date() }).where(eq(sessions.id, id));
    return Response.json({ ok: true, summary: null, created: 0, warning: (e as Error).message });
  }
}
