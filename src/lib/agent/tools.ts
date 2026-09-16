import type Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { problems, sessions, type EditorState, type Problem } from "@/lib/db/schema";
import { boardOpsSchema, COLORS } from "@/lib/board/ops";
import { saveMemory } from "@/lib/memory/retrieve";
import { getDaily, searchProblems } from "@/lib/leetcode/client";
import { importLeetCodeProblem, LeetCodeImportError } from "@/lib/leetcode/import";
import { runOnServer } from "@/lib/runner/server";
import type { RunRequest, RunResult } from "@/lib/runner/types";
import type { ChatEvent } from "./events";

/* ------------------------------------------------------------------ */
/* Schemas                                                             */
/* ------------------------------------------------------------------ */

export const drawInput = z.object({
  ops: boardOpsSchema.describe("Ordered list of drawing operations to apply"),
});

export const editorInput = z.object({
  language: z.enum(["javascript", "python"]),
  source: z.string().max(20000),
});

export const memoryInput = z.object({
  kind: z.enum(["weakness", "strength", "preference", "progress", "fact"]),
  content: z.string().min(8).max(400).describe("One self-contained sentence about the learner"),
});

const ioKind = z
  .enum(["raw", "list", "tree", "list[]", "tree[]"])
  .describe(
    '"raw" = any plain JSON value incl. arrays/nested arrays (the default). "list" = a singly LINKED list (ListNode) built from an array; "tree" = a binary tree (TreeNode) built from a level-order array; "list[]"/"tree[]" = arrays of those. Never use "list" for an ordinary array.',
  );
const testCase = z.object({
  name: z.string().max(60).optional(),
  args: z.array(z.unknown()).describe("Positional arguments, JSON values. Lists/trees as arrays (level-order with null)."),
  expected: z.unknown(),
  unordered: z.boolean().optional().describe("Compare as unordered collections"),
});

export const exerciseInput = z.object({
  title: z.string().min(3).max(80),
  promptMd: z.string().min(20).max(6000).describe("Problem statement in markdown, with at least one worked example"),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  starterCode: z.object({
    javascript: z.string().max(4000).optional(),
    python: z.string().max(4000).optional(),
  }),
  entryFn: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/).describe("camelCase function name (Python may use snake_case of it)"),
  io: z
    .object({ args: z.array(ioKind), result: ioKind })
    .optional()
    .describe("OMIT unless a parameter or the result is a linked list or binary tree. Plain arrays need no io spec."),
  tests: z.array(testCase).min(1).max(12),
  hints: z.array(z.string().max(300)).max(4).optional(),
  /** Switch the editor to this language (use the learner's preferred one). */
  language: z.enum(["javascript", "python"]).optional(),
  referenceSolution: z
    .object({ javascript: z.string().max(6000).optional(), python: z.string().max(6000).optional() })
    .describe("A correct solution in at least one language. It is executed against `tests` before the exercise is created; the exercise is rejected if any test fails."),
});

export const testsInput = z.object({
  tests: z.array(testCase).min(1).max(12),
  referenceSolution: z
    .object({ javascript: z.string().max(6000).optional(), python: z.string().max(6000).optional() })
    .optional()
    .describe("Optional correct solution used to validate the new tests before saving them."),
});

export const editCodeInput = z.object({
  edits: z
    .array(
      z.object({
        find: z.string().min(1).max(4000).describe("Exact text to replace (include enough surrounding lines to be unique). Whitespace-sensitive."),
        replace: z.string().max(4000).describe("Replacement text (empty string deletes)."),
      }),
    )
    .min(1)
    .max(8),
});

export const runCodeInput = z.object({
  language: z.enum(["javascript", "python"]).optional().describe("Defaults to the learner's current editor language"),
  source: z.string().max(20000).optional().describe("Code to run. OMIT to run the learner's current editor code as-is."),
  tests: z.array(testCase).max(12).optional().describe("Tests to run. OMIT to use the active problem's tests."),
  entryFn: z.string().optional().describe("Defaults to the active problem's entry function"),
});

export const lcSearchInput = z.object({
  query: z.string().max(80).optional().describe("Keywords in the title"),
  tags: z.array(z.string()).max(3).optional().describe('LeetCode tag slugs, e.g. "two-pointers", "dynamic-programming", "binary-search"'),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
  limit: z.number().int().min(1).max(15).optional(),
});

export const lcImportInput = z.object({
  slug: z.string().min(1).max(120).describe("LeetCode title slug, e.g. two-sum"),
  language: z.enum(["javascript", "python"]).optional().describe("Switch the editor to this language"),
});

/* ------------------------------------------------------------------ */
/* Tool definitions (fixed order — part of the cached prefix)          */
/* ------------------------------------------------------------------ */

const jsonSchema = (s: z.ZodType) =>
  z.toJSONSchema(s, { target: "draft-7", io: "input" }) as Anthropic.Tool.InputSchema;

export const TOOLS: Anthropic.ToolUnion[] = [
  {
    name: "draw_on_board",
    description: `Draw on the shared whiteboard. Ops: add_box{x,y,w?,h?,label?,color?,geo?,fill?}, add_text{x,y,text,size?}, add_note{x,y,text,color?}, add_arrow{from?,to?,start?,end?,label?,dashed?} (from/to are shape ids), add_array{x,y,values[],label?,highlight?[],pointers?{"idx":"label"}}, update_label{id,text}, set_color{ids[],color}, move{id,x,y}, delete{ids[]}, clear, draw_mermaid{source,x?,y?}. Give ids to shapes you may update later. Colors: ${COLORS.join(", ")}.`,
    input_schema: jsonSchema(drawInput),
  },
  {
    name: "set_editor_code",
    description:
      "Replace the contents of the learner's code editor (opens the editor if closed). Use for skeletons, harnesses, or fixes the learner asked for — not for dumping full solutions unprompted.",
    input_schema: jsonSchema(editorInput),
  },
  {
    name: "set_exercise",
    description:
      "Create a hands-on coding exercise and make it the session's active problem: the editor gets the starter code and ▶ Run executes your tests. Your referenceSolution is executed against the tests first; if anything fails you get the failures back and nothing is created — fix and retry.",
    input_schema: jsonSchema(exerciseInput),
  },
  {
    name: "set_tests",
    description:
      "Replace the test cases of the current (tutor-authored or LeetCode-imported) problem, e.g. when examples couldn't be parsed or you want edge cases. Pass a referenceSolution so the tests are validated.",
    input_schema: jsonSchema(testsInput),
  },
  {
    name: "edit_code",
    description:
      "Make targeted edits to the learner's editor code (exact find/replace; each `find` must match exactly once). Prefer this over set_editor_code for fixes, additions, or removing a line — it preserves everything else. Edits are applied in order to the current editor contents.",
    input_schema: jsonSchema(editCodeInput),
  },
  {
    name: "run_code",
    description:
      "Execute code on the server and get test results/stdout/errors. With no arguments it runs the learner's current editor code against the active problem's tests — use this to check their work without making them press Run, or to verify a fix or a solution of your own before showing it. Never claim code passes without running it.",
    input_schema: jsonSchema(runCodeInput),
  },
  {
    name: "leetcode_search",
    description: "Search LeetCode problems by keyword, tag slugs and/or difficulty. Returns slugs you can pass to leetcode_import.",
    input_schema: jsonSchema(lcSearchInput),
  },
  {
    name: "leetcode_import",
    description: "Import a LeetCode problem (by slug) as this session's active problem, with its official starter code and tests derived from the examples.",
    input_schema: jsonSchema(lcImportInput),
  },
  {
    name: "leetcode_daily",
    description: "Get today's LeetCode daily challenge (slug, title, difficulty).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "save_memory",
    description:
      "Remember something durable about this learner for future sessions (a weakness, strength, preference, or milestone). One sentence.",
    input_schema: jsonSchema(memoryInput),
  },
];

/* ------------------------------------------------------------------ */
/* Execution                                                           */
/* ------------------------------------------------------------------ */

export type ToolContext = {
  userId: string;
  sessionId: string;
  problem: Problem | null;
  /** The learner's editor contents at the start of the turn (kept current when the tutor edits it). */
  editor: EditorState | null;
  emit: (e: ChatEvent) => void;
  onEditorSet: (e: EditorState) => void;
  onProblemSet: (p: Problem) => void;
};

type ToolResult = { content: string; isError?: boolean };
const invalid = (e: z.ZodError): ToolResult => ({ content: `Invalid input: ${z.prettifyError(e)}`, isError: true });

/** Runs one tool call; returns the tool_result content string. */
export async function executeTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolResult> {
  switch (name) {
    case "draw_on_board": {
      const parsed = drawInput.safeParse(input);
      if (!parsed.success) return invalid(parsed.error);
      // Give ids to shapes that lack one so later ops (and the model) can refer to them.
      const ops = parsed.data.ops.map((op) => {
        if ("id" in op || !("op" in op)) return op;
        if (op.op === "add_box" || op.op === "add_text" || op.op === "add_note" || op.op === "add_arrow" || op.op === "add_array") {
          return { ...op, id: `${op.op.slice(4)}-${Math.random().toString(36).slice(2, 7)}` };
        }
        return op;
      });
      ctx.emit({ type: "board_ops", ops });
      const ids = ops.flatMap((o) => ("id" in o && o.id ? [o.id] : []));
      return { content: `Applied ${ops.length} op(s).${ids.length ? ` Shape ids: ${ids.join(", ")}` : ""}` };
    }

    case "set_editor_code": {
      const parsed = editorInput.safeParse(input);
      if (!parsed.success) return invalid(parsed.error);
      ctx.onEditorSet(parsed.data);
      ctx.emit({ type: "editor_set", editor: parsed.data });
      return { content: "Editor updated." };
    }

    case "set_exercise": {
      const parsed = exerciseInput.safeParse(input);
      if (!parsed.success) return invalid(parsed.error);
      const x = parsed.data;
      const verdict = await verifyTests(x.referenceSolution, x.tests, x.entryFn, x.io ?? null);
      if (verdict) return { content: `Exercise NOT created — the reference solution fails its own tests:\n${verdict}`, isError: true };
      const [problem] = await db
        .insert(problems)
        .values({
          slug: `tutor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          title: x.title,
          kind: "dsa",
          source: "tutor",
          difficulty: x.difficulty ?? "medium",
          category: "Tutor exercise",
          tags: [],
          promptMd: x.promptMd,
          starterCode: x.starterCode,
          entryFn: x.entryFn,
          io: x.io ?? null,
          tests: x.tests,
          hints: x.hints ?? [],
        })
        .returning();
      await attachProblem(ctx, problem, x.language);
      return { content: `Exercise "${problem.title}" is now active with ${x.tests.length} test(s). The editor shows the starter code.` };
    }

    case "set_tests": {
      const parsed = testsInput.safeParse(input);
      if (!parsed.success) return invalid(parsed.error);
      if (!ctx.problem) return { content: "No active problem to attach tests to — use set_exercise first.", isError: true };
      if (ctx.problem.source === "seed") return { content: "Tests of built-in problems are fixed.", isError: true };
      if (parsed.data.referenceSolution) {
        const verdict = await verifyTests(parsed.data.referenceSolution, parsed.data.tests, ctx.problem.entryFn ?? "", ctx.problem.io);
        if (verdict) return { content: `Tests NOT saved — the reference solution fails them:\n${verdict}`, isError: true };
      }
      const [problem] = await db.update(problems).set({ tests: parsed.data.tests }).where(eq(problems.id, ctx.problem.id)).returning();
      ctx.onProblemSet(problem);
      ctx.emit({ type: "exercise_set", problem });
      return { content: `Replaced tests (${parsed.data.tests.length}).` };
    }

    case "edit_code": {
      const parsed = editCodeInput.safeParse(input);
      if (!parsed.success) return invalid(parsed.error);
      if (!ctx.editor) return { content: "No editor contents available to edit.", isError: true };
      let source = ctx.editor.source;
      const applied: string[] = [];
      for (const [i, e] of parsed.data.edits.entries()) {
        const count = source.split(e.find).length - 1;
        if (count !== 1) {
          return {
            content: `Edit ${i + 1} not applied: \`find\` matches ${count} time(s) (must be exactly 1). ${applied.length ? `Earlier edits (${applied.length}) were NOT applied either — resend all.` : ""}\nCurrent code:\n${source}`,
            isError: true,
          };
        }
        source = source.replace(e.find, () => e.replace);
        applied.push(e.find.split("\n")[0].slice(0, 40));
      }
      const next: EditorState = { language: ctx.editor.language, source };
      ctx.onEditorSet(next);
      ctx.emit({ type: "editor_set", editor: next });
      return { content: `Applied ${applied.length} edit(s). Editor now:\n${source}` };
    }

    case "run_code": {
      const parsed = runCodeInput.safeParse(input);
      if (!parsed.success) return invalid(parsed.error);
      const x = parsed.data;
      const language = x.language ?? ctx.editor?.language ?? "javascript";
      const source = x.source ?? (language === ctx.editor?.language ? ctx.editor?.source : undefined);
      if (!source?.trim()) return { content: "Nothing to run: the editor is empty and no source was given.", isError: true };
      const tests = x.tests ?? ctx.problem?.tests ?? [];
      const req: RunRequest = { language, source, tests, entryFn: x.entryFn ?? ctx.problem?.entryFn ?? null, io: ctx.problem?.io ?? null };
      const r = await runOnServer(req);
      return { content: formatRun(r, x.source ? "your code" : "the learner's editor code") };
    }

    case "leetcode_search": {
      const parsed = lcSearchInput.safeParse(input);
      if (!parsed.success) return invalid(parsed.error);
      try {
        const r = await searchProblems(parsed.data);
        const lines = r.problems.map(
          (p) => `${p.id}. ${p.title} [${p.slug}] ${p.difficulty}${p.paidOnly ? " (premium)" : ""} ac=${p.acRate}% tags=${p.tags.join(",")}`,
        );
        return { content: `${r.total} match(es). Top results:\n${lines.join("\n") || "(none)"}` };
      } catch (e) {
        return { content: `LeetCode search failed: ${(e as Error).message}`, isError: true };
      }
    }

    case "leetcode_import": {
      const parsed = lcImportInput.safeParse(input);
      if (!parsed.success) return invalid(parsed.error);
      try {
        const { problem, notes } = await importLeetCodeProblem(parsed.data.slug);
        await attachProblem(ctx, problem, parsed.data.language);
        return {
          content: `Imported "${problem.title}" (${problem.difficulty}) as the active problem with ${problem.tests.length} test(s) and entry ${problem.entryFn ?? "(none)"}.${notes.length ? `\nNotes: ${notes.join(" ")}` : ""}\n\nStatement:\n${problem.promptMd.slice(0, 3000)}`,
        };
      } catch (e) {
        const msg = e instanceof LeetCodeImportError ? e.message : `Import failed: ${(e as Error).message}`;
        return { content: msg, isError: true };
      }
    }

    case "leetcode_daily": {
      try {
        const d = await getDaily();
        return { content: `Daily challenge for ${d.date}: ${d.title} [${d.slug}] (${d.difficulty}).` };
      } catch (e) {
        return { content: `Could not fetch the daily challenge: ${(e as Error).message}`, isError: true };
      }
    }

    case "save_memory": {
      const parsed = memoryInput.safeParse(input);
      if (!parsed.success) return invalid(parsed.error);
      try {
        const r = await saveMemory({ userId: ctx.userId, sourceSessionId: ctx.sessionId, ...parsed.data });
        return { content: r === "created" ? "Saved." : "Already remembered something similar." };
      } catch (e) {
        return { content: `Could not save memory: ${(e as Error).message}`, isError: true };
      }
    }

    default:
      return { content: `Unknown tool ${name}`, isError: true };
  }
}

/** Runs a reference solution against tests; returns a failure report or null when everything passes. */
async function verifyTests(
  reference: { javascript?: string; python?: string },
  tests: RunRequest["tests"],
  entryFn: string,
  io: RunRequest["io"],
): Promise<string | null> {
  const langs = (["javascript", "python"] as const).filter((l) => reference[l]?.trim());
  if (!langs.length) return "No reference solution provided.";
  const reports: string[] = [];
  for (const language of langs) {
    const r = await runOnServer({ language, source: reference[language]!, tests, entryFn, io });
    const bad = r.tests.filter((t) => !t.passed);
    if (r.error || bad.length) reports.push(`[${language}] ${formatRun(r, "reference solution")}`);
  }
  return reports.length ? reports.join("\n") : null;
}

function formatRun(r: RunResult, what: string): string {
  const lines: string[] = [];
  if (r.error) lines.push(`Run of ${what} failed: ${r.error.slice(0, 600)}`);
  if (r.tests.length) {
    const passed = r.tests.filter((t) => t.passed).length;
    lines.push(`${what}: ${passed}/${r.tests.length} tests passed (${r.durationMs} ms)`);
    for (const t of r.tests.filter((x) => !x.passed).slice(0, 5)) {
      lines.push(
        t.error
          ? `  ✗ ${t.name}: ${t.error.split("\n").filter(Boolean).slice(-2).join(" | ").slice(0, 300)}`
          : `  ✗ ${t.name}: expected ${JSON.stringify(t.expected)}, got ${JSON.stringify(t.actual)}`,
      );
    }
  } else if (!r.error) {
    lines.push(`${what} ran without tests (${r.durationMs} ms).`);
  }
  if (r.stdout) lines.push(`stdout: ${r.stdout.slice(0, 500)}`);
  if (r.stderr) lines.push(`stderr: ${r.stderr.slice(0, 300)}`);
  return lines.join("\n");
}

async function attachProblem(ctx: ToolContext, problem: Problem, language?: "javascript" | "python") {
  await db
    .update(sessions)
    .set({ problemId: problem.id, title: problem.title, updatedAt: new Date() })
    .where(eq(sessions.id, ctx.sessionId));
  ctx.onProblemSet(problem);
  ctx.emit({ type: "exercise_set", problem, language });
}
