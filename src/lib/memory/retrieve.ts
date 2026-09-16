import { and, cosineDistance, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { memories, type Memory, type MemoryKind } from "@/lib/db/schema";
import { embed } from "./embed";

export type RetrievedMemory = Pick<Memory, "id" | "kind" | "content" | "createdAt">;

/**
 * Memories relevant to the current turn: top-k by cosine similarity to the
 * query, plus the most recent preferences (always useful for tone/format).
 */
export async function retrieveMemories(userId: string, query: string, k = 6): Promise<RetrievedMemory[]> {
  const count = await db.$count(memories, eq(memories.userId, userId));
  if (count === 0) return [];

  const q = await embed(query);
  const similarity = sql<number>`1 - (${cosineDistance(memories.embedding, q)})`;

  const [similar, prefs] = await Promise.all([
    db
      .select({ id: memories.id, kind: memories.kind, content: memories.content, createdAt: memories.createdAt, similarity })
      .from(memories)
      .where(and(eq(memories.userId, userId), gt(similarity, 0.25)))
      .orderBy((t) => desc(t.similarity))
      .limit(k),
    db
      .select({ id: memories.id, kind: memories.kind, content: memories.content, createdAt: memories.createdAt })
      .from(memories)
      .where(and(eq(memories.userId, userId), eq(memories.kind, "preference")))
      .orderBy(desc(memories.createdAt))
      .limit(4),
  ]);

  const seen = new Set<string>();
  const out: RetrievedMemory[] = [];
  for (const m of [...prefs, ...similar]) {
    if (seen.has(m.id)) continue;
    seen.add(m.id);
    out.push({ id: m.id, kind: m.kind, content: m.content, createdAt: m.createdAt });
  }
  if (out.length) {
    void db
      .update(memories)
      .set({ lastAccessedAt: new Date() })
      .where(inArray(memories.id, out.map((m) => m.id)));
  }
  return out;
}

/** Inserts a memory unless a near-duplicate (cosine > 0.92) already exists. */
export async function saveMemory(opts: {
  userId: string;
  kind: MemoryKind;
  content: string;
  sourceSessionId?: string | null;
}): Promise<"created" | "duplicate"> {
  const vec = await embed(opts.content);
  const similarity = sql<number>`1 - (${cosineDistance(memories.embedding, vec)})`;
  const dup = await db
    .select({ id: memories.id })
    .from(memories)
    .where(and(eq(memories.userId, opts.userId), gt(similarity, 0.92)))
    .limit(1);
  if (dup.length) return "duplicate";

  await db.insert(memories).values({
    userId: opts.userId,
    kind: opts.kind,
    content: opts.content,
    embedding: vec,
    sourceSessionId: opts.sourceSessionId ?? null,
  });
  return "created";
}

export function formatMemories(ms: RetrievedMemory[]): string {
  return ms.map((m) => `- [${m.kind}] ${m.content}`).join("\n");
}
