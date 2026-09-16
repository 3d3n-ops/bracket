import type { NextRequest } from "next/server";
import { searchProblems, type LcDifficulty } from "@/lib/leetcode/client";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const difficulty = p.get("difficulty")?.toUpperCase();
  try {
    const r = await searchProblems({
      query: p.get("q") ?? undefined,
      tags: p.getAll("tag"),
      difficulty: difficulty === "EASY" || difficulty === "MEDIUM" || difficulty === "HARD" ? (difficulty as LcDifficulty) : undefined,
      limit: Number(p.get("limit") ?? 12),
    });
    return Response.json(r);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
