import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, sessions, type Problem } from "@/lib/db/schema";
import { anthropic, TUTOR_MODEL } from "@/lib/agent/client";
import { saveMemory } from "./retrieve";

const extraction = z.object({
  summary: z.string().describe("2-3 sentence summary of what happened in the session"),
  memories: z.array(
    z.object({
      kind: z.enum(["weakness", "strength", "preference", "progress", "fact"]),
      content: z.string().describe("One self-contained sentence about the learner, useful in future sessions"),
    }),
  ),
});

/**
 * Reads a session transcript, extracts durable facts about the learner into
 * `memories`, and stores a summary on the session. Called when a session ends.
 */
export async function extractSessionMemories(sessionId: string, userId: string, problem: Problem | null) {
  const rows = await db.select().from(messages).where(eq(messages.sessionId, sessionId)).orderBy(asc(messages.createdAt));
  const transcript = rows
    .map((r) => {
      if (r.role === "user") return r.displayText ? `LEARNER: ${r.displayText}` : null;
      const blocks = r.content as Anthropic.ContentBlock[];
      const text = blocks.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("");
      return text ? `TUTOR: ${text}` : null;
    })
    .filter(Boolean)
    .join("\n\n");

  if (transcript.length < 200) return { summary: null, created: 0 };

  const res = await anthropic.messages.parse({
    model: TUTOR_MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(extraction) },
    system:
      "You extract long-term coaching memory from a tutoring transcript. Only record things that will still be true and useful next week: recurring weaknesses, demonstrated strengths, stated preferences (language, style, pace), and milestones. Skip session-specific details. 0-6 memories; fewer is better.",
    messages: [
      {
        role: "user",
        content: `Problem: ${problem ? `${problem.title} (${problem.kind}, ${problem.difficulty})` : "freestyle"}\n\nTranscript:\n${transcript.slice(0, 60000)}`,
      },
    ],
  });

  const out = res.parsed_output;
  if (!out) return { summary: null, created: 0 };

  let created = 0;
  for (const m of out.memories) {
    const r = await saveMemory({ userId, sourceSessionId: sessionId, kind: m.kind, content: m.content });
    if (r === "created") created++;
  }
  await db.update(sessions).set({ summary: out.summary, status: "closed", updatedAt: new Date() }).where(eq(sessions.id, sessionId));
  return { summary: out.summary, created };
}
