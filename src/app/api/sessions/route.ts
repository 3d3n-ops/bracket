import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { problems, sessions, type Problem } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth/anon";
import { importLeetCodeProblem, LeetCodeImportError } from "@/lib/leetcode/import";

const bodySchema = z.object({
  problemId: z.uuid().nullable().optional(),
  leetcodeSlug: z.string().max(120).optional(),
  mode: z.enum(["problem", "learn", "freestyle"]).optional(),
  topic: z.string().max(200).nullable().optional(),
});

/** Creates a session from a seeded problem, a LeetCode slug, a learn topic, or nothing (freestyle). */
export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const b = parsed.data;

  let problem: Problem | null = null;
  if (b.problemId) {
    problem = (await db.select().from(problems).where(eq(problems.id, b.problemId)).limit(1))[0] ?? null;
    if (!problem) return Response.json({ error: "Problem not found" }, { status: 404 });
  } else if (b.leetcodeSlug) {
    try {
      problem = (await importLeetCodeProblem(b.leetcodeSlug)).problem;
    } catch (e) {
      const msg = e instanceof LeetCodeImportError ? e.message : `LeetCode import failed: ${(e as Error).message}`;
      return Response.json({ error: msg }, { status: 422 });
    }
  }

  const mode = problem ? "problem" : (b.mode ?? "freestyle");
  const topic = mode === "learn" ? (b.topic?.trim() || null) : null;
  const title = problem ? problem.title : mode === "learn" ? (topic ? `Learn: ${topic}` : "Surprise me") : "Freestyle session";

  const [session] = await db
    .insert(sessions)
    .values({
      userId,
      problemId: problem?.id ?? null,
      title,
      mode,
      topic,
      code: problem ? { language: "javascript", source: problem.starterCode.javascript ?? "" } : null,
    })
    .returning({ id: sessions.id });
  return Response.json({ id: session.id });
}
