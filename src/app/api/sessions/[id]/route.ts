import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { sessions } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth/anon";

const patchSchema = z.object({
  boardSnapshot: z.unknown().optional(),
  code: z.object({ language: z.enum(["javascript", "python"]), source: z.string().max(50000) }).optional(),
});

export async function GET(_req: Request, ctx: RouteContext<"/api/sessions/[id]">) {
  const { id } = await ctx.params;
  const userId = await getCurrentUserId();
  const [s] = await db.select().from(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, userId))).limit(1);
  return s ? Response.json(s) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/sessions/[id]">) {
  const { id } = await ctx.params;
  const userId = await getCurrentUserId();
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });

  const set: Partial<typeof sessions.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.boardSnapshot !== undefined) set.boardSnapshot = parsed.data.boardSnapshot;
  if (parsed.data.code) set.code = parsed.data.code;

  const updated = await db
    .update(sessions)
    .set(set)
    .where(and(eq(sessions.id, id), eq(sessions.userId, userId)))
    .returning({ id: sessions.id });
  return updated.length ? Response.json({ ok: true }) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function DELETE(_req: Request, ctx: RouteContext<"/api/sessions/[id]">) {
  const { id } = await ctx.params;
  const userId = await getCurrentUserId();
  await db.delete(sessions).where(and(eq(sessions.id, id), eq(sessions.userId, userId)));
  return Response.json({ ok: true });
}
