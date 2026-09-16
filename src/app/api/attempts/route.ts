import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { attempts, sessions } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth/anon";

const bodySchema = z.object({
  sessionId: z.uuid(),
  problemId: z.uuid().nullable().optional(),
  language: z.enum(["javascript", "python"]),
  source: z.string().max(50000),
  passed: z.number().int().min(0),
  total: z.number().int().min(0),
});

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const b = parsed.data;

  const [s] = await db.select({ id: sessions.id }).from(sessions).where(and(eq(sessions.id, b.sessionId), eq(sessions.userId, userId))).limit(1);
  if (!s) return Response.json({ error: "Session not found" }, { status: 404 });

  await db.insert(attempts).values({
    sessionId: b.sessionId,
    problemId: b.problemId ?? null,
    language: b.language,
    source: b.source,
    passed: b.passed,
    total: b.total,
    allPassed: b.total > 0 && b.passed === b.total,
  });
  return Response.json({ ok: true });
}
