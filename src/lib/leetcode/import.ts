import TurndownService from "turndown";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { problems, type IoKind, type Problem, type ProblemIO, type TestCase } from "@/lib/db/schema";
import { getQuestion, type LcQuestion } from "./client";

const turndown = new TurndownService({ codeBlockStyle: "fenced", headingStyle: "atx" });

export class LeetCodeImportError extends Error {}

/**
 * Fetches a LeetCode problem and stores it as one of ours (idempotent: an
 * already-imported slug is returned as-is). Starter code comes from
 * LeetCode's own snippets, the entry function + list/tree conversions from
 * `metaData`, and tests from the worked examples in the statement.
 */
export async function importLeetCodeProblem(slug: string): Promise<{ problem: Problem; notes: string[] }> {
  const ourSlug = `leetcode-${slug}`;
  const [existing] = await db.select().from(problems).where(eq(problems.slug, ourSlug)).limit(1);
  if (existing) return { problem: existing, notes: [] };

  const q = await getQuestion(slug);
  if (!q) throw new LeetCodeImportError(`No LeetCode problem with slug "${slug}".`);
  if (q.paidOnly || !q.contentHtml) {
    throw new LeetCodeImportError(`"${q.title}" is a LeetCode Premium problem; its statement isn't publicly available.`);
  }

  const notes: string[] = [];
  const io = deriveIo(q, notes);
  const tests = deriveTests(q, notes);
  const promptMd = `${turndown.turndown(q.contentHtml).trim()}\n\n_Imported from [LeetCode #${q.id}](https://leetcode.com/problems/${q.slug}/)._`;

  const [problem] = await db
    .insert(problems)
    .values({
      slug: ourSlug,
      title: `${q.id}. ${q.title}`,
      kind: "dsa",
      source: "leetcode",
      externalId: q.slug,
      url: `https://leetcode.com/problems/${q.slug}/`,
      difficulty: q.difficulty.toLowerCase() as Problem["difficulty"],
      category: q.tags[0]?.name ?? "LeetCode",
      tags: q.tags.map((t) => t.slug),
      promptMd,
      starterCode: {
        javascript: q.snippets.javascript ?? "",
        python: q.snippets.python3 ?? "",
      },
      entryFn: q.metaData?.classname ? null : (q.metaData?.name ?? null),
      io,
      tests,
      hints: q.hints.map(stripHtml),
    })
    .returning();
  return { problem, notes };
}

/* ------------------------------------------------------------------ */

function kindFor(type: string): IoKind | null {
  if (type === "ListNode") return "list";
  if (type === "TreeNode") return "tree";
  if (type === "ListNode[]") return "list[]";
  if (type === "TreeNode[]") return "tree[]";
  // Primitives, arrays of primitives (string[][]) and LeetCode's list<list<...>> spellings are all plain JSON.
  if (/^(integer|string|boolean|double|long|character|void)(\[\])*$/.test(type)) return "raw";
  if (/^list<(list<)*(integer|string|boolean|double|long|character)>+$/.test(type)) return "raw";
  return null;
}

function deriveIo(q: LcQuestion, notes: string[]): ProblemIO | null {
  const m = q.metaData;
  if (!m) return null;
  if (m.classname) {
    notes.push("This is a class-design problem (LeetCode wants a class, not a function); tests can't be auto-derived — write a small harness with set_exercise if you want runnable tests.");
    return null;
  }
  const args: IoKind[] = [];
  for (const p of m.params) {
    const k = kindFor(p.type);
    if (!k) {
      notes.push(`Parameter "${p.name}" has type ${p.type}, which the runner can't construct; tests were skipped.`);
      return null;
    }
    args.push(k);
  }
  const ret = kindFor(m.return.type);
  if (!ret || ret === "list[]" || ret === "tree[]") {
    notes.push(`Return type ${m.return.type} can't be compared automatically; tests were skipped.`);
    return null;
  }
  return { args, result: ret };
}

function deriveTests(q: LcQuestion, notes: string[]): TestCase[] {
  if (!q.contentHtml || !q.metaData || q.metaData.classname) return [];
  // Two statement styles exist: `<pre>` blocks and `<span class="example-io">` blocks (HTML-escaped).
  const outputs = [...q.contentHtml.matchAll(/<strong>Output:?<\/strong>\s*(?:<span[^>]*>)?\s*([^\n<]+)/gi)].map((m) =>
    decodeEntities(m[1].trim()),
  );
  const unordered = /in any order/i.test(q.contentHtml.replace(/<[^>]+>/g, ""));
  const tests: TestCase[] = [];

  q.exampleInputs.forEach((raw, i) => {
    const out = outputs[i];
    if (out === undefined) return;
    try {
      const lines = raw.split("\n");
      if (lines.length !== q.metaData!.params.length) return;
      const args = lines.map((l) => JSON.parse(l));
      const expected = JSON.parse(out);
      tests.push({ name: `Example ${i + 1}`, args, expected, unordered: unordered || undefined });
    } catch {
      /* unparseable example — skip */
    }
  });

  if (!tests.length) notes.push("Couldn't parse the worked examples into tests; ask the tutor to add tests with set_tests.");
  else if (tests.length < q.exampleInputs.length) notes.push(`Only ${tests.length} of ${q.exampleInputs.length} examples could be turned into tests.`);
  return tests;
}

function decodeEntities(s: string) {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function stripHtml(s: string) {
  return turndown.turndown(s).trim();
}
