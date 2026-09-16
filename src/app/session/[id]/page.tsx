import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, problems, sessions } from "@/lib/db/schema";
import { getCurrentUserId } from "@/lib/auth/anon";
import { Workspace } from "@/components/workspace/Workspace";
import { toDisplayMessages } from "@/lib/agent/history";
import { hasServerVoice } from "@/lib/voice/openai";

export default async function SessionPage({ params }: PageProps<"/session/[id]">) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  const [session] = await db
    .select()
    .from(sessions)
    .where(and(eq(sessions.id, id), eq(sessions.userId, userId)))
    .limit(1);
  if (!session) notFound();

  const problem = session.problemId
    ? (await db.select().from(problems).where(eq(problems.id, session.problemId)).limit(1))[0] ?? null
    : null;

  const history = await db
    .select()
    .from(messages)
    .where(eq(messages.sessionId, id))
    .orderBy(asc(messages.createdAt));

  const provider = hasServerVoice() ? "server" : "browser";
  return (
    <Workspace
      session={session}
      problem={problem}
      messages={toDisplayMessages(history)}
      voice={{ stt: provider, tts: provider }}
    />
  );
}
