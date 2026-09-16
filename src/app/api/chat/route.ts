import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { problems, sessions } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth/anon";
import { runTurn } from "@/lib/agent/run";
import { encodeEvent } from "@/lib/agent/events";

export const maxDuration = 300;

const bodySchema = z.object({
  sessionId: z.uuid(),
  text: z.string().max(8000).default(""),
  kickoff: z.boolean().optional(),
  board: z
    .object({
      shapes: z.array(z.record(z.string(), z.unknown())),
      total: z.number(),
      viewport: z.object({ x: z.number(), y: z.number(), w: z.number(), h: z.number() }),
    })
    .nullable()
    .optional(),
  code: z.object({ language: z.enum(["javascript", "python"]), source: z.string().max(50000) }).nullable().optional(),
  lastRun: z.record(z.string(), z.unknown()).nullable().optional(),
});

export async function POST(req: Request) {
  const userId = await getCurrentUserId();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });
  const body = parsed.data;
  if (!body.kickoff && !body.text.trim()) return Response.json({ error: "text required" }, { status: 400 });

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, body.sessionId), eq(sessions.userId, userId)))
    .limit(1);
  if (!session) return Response.json({ error: "Session not found" }, { status: 404 });

  const problem = session.problemId
    ? (await db.select().from(problems).where(eq(problems.id, session.problemId)).limit(1))[0] ?? null
    : null;

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const turn = runTurn(
          {
            userId,
            session,
            problem,
            text: body.kickoff
              ? "(The learner just opened this session. Greet them in one or two sentences and get started — don't wait for them to speak first.)"
              : body.text,
            kickoff: body.kickoff,
            board: (body.board as Parameters<typeof runTurn>[0]["board"]) ?? null,
            code: body.code ?? null,
            lastRun: (body.lastRun as Parameters<typeof runTurn>[0]["lastRun"]) ?? null,
          },
          req.signal,
        );
        for await (const ev of turn) controller.enqueue(encoder.encode(encodeEvent(ev)));
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        console.error("[chat]", e);
        controller.enqueue(encoder.encode(encodeEvent({ type: "error", message })));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
