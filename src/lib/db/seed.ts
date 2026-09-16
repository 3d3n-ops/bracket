import { config } from "dotenv";
config({ path: [".env.local", ".env"] });
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { allProblems } from "@/content/problems";
import { problems } from "./schema";

async function main() {
  const db = drizzle(neon(process.env.DATABASE_URL!));

  for (const p of allProblems) {
    await db
      .insert(problems)
      .values({
        slug: p.slug,
        title: p.title,
        kind: p.kind,
        difficulty: p.difficulty,
        category: p.category,
        tags: p.tags,
        promptMd: p.promptMd,
        starterCode: p.starterCode,
        entryFn: p.entryFn ?? null,
        io: p.io ?? null,
        tests: p.tests,
        hints: p.hints,
        solutionMd: p.solutionMd ?? null,
      })
      .onConflictDoUpdate({
        target: problems.slug,
        set: {
          title: p.title,
          kind: p.kind,
          difficulty: p.difficulty,
          category: p.category,
          tags: p.tags,
          promptMd: p.promptMd,
          starterCode: p.starterCode,
          entryFn: p.entryFn ?? null,
          io: p.io ?? null,
          tests: p.tests,
          hints: p.hints,
          solutionMd: p.solutionMd ?? null,
        },
      });
  }
  console.log(`Seeded ${allProblems.length} problems`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
