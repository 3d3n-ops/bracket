import Anthropic from "@anthropic-ai/sdk";
import { asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, sessions, type EditorState, type Problem, type Session } from "@/lib/db/schema";
import type { CompactBoard } from "@/lib/board/ops";
import type { RunResult } from "@/lib/runner/types";
import { formatMemories, retrieveMemories } from "@/lib/memory/retrieve";
import { anthropic, TUTOR_MODEL } from "./client";
import type { ChatEvent } from "./events";
import { toMessageParams } from "./history";
import { buildSystemPrompt } from "./system-prompt";
import { TOOLS, executeTool } from "./tools";

type Param = Anthropic.MessageParam;

export type TurnInput = {
  userId: string;
  session: Session;
  problem: Problem | null;
  text: string;
  /** First turn of a learn/freestyle session: the tutor opens; the "user" turn is hidden. */
  kickoff?: boolean;
  board: CompactBoard | null;
  code: EditorState | null;
  lastRun: RunResult | null;
};

const MAX_ITERATIONS = 8;

/**
 * Runs one tutor turn: builds the request, streams the reply, executes tool
 * calls (drawing / editor / memory), persists every message, and yields
 * ChatEvents for the SSE route.
 */
export async function* runTurn(input: TurnInput, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
  const { userId, session } = input;
  let problem = input.problem; // may change mid-turn via set_exercise / leetcode_import

  // 1. Long-term memories relevant to this turn (go into the user turn's context block).
  let memoryNote: string | null = null;
  try {
    const mems = await retrieveMemories(userId, input.text);
    if (process.env.NODE_ENV !== "production") console.log(`[tutor] memories=${mems.length}`);
    if (mems.length) memoryNote = formatMemories(mems);
  } catch (e) {
    console.warn("memory retrieval skipped:", (e as Error).message);
  }

  // 2. History + new user turn (persist immediately so a crash mid-turn keeps the question).
  const rows = await db.select().from(messages).where(eq(messages.sessionId, session.id)).orderBy(asc(messages.createdAt));
  const history = toMessageParams(rows);
  const userContent = buildUserContent(input, memoryNote);
  await db.insert(messages).values({
    sessionId: session.id,
    role: "user",
    content: userContent,
    displayText: input.kickoff ? null : input.text,
  });

  const convo: Param[] = [...history, { role: "user", content: userContent }];

  // 3. Agent loop.
  const queue: ChatEvent[] = [];
  let editorSet: EditorState | null = null;
  let editor: EditorState | null = input.code;
  const ctx = {
    userId,
    sessionId: session.id,
    get problem() {
      return problem;
    },
    get editor() {
      return editor;
    },
    emit: (e: ChatEvent) => queue.push(e),
    onEditorSet: (e: EditorState) => {
      editorSet = e;
      editor = e;
    },
    onProblemSet: (p: Problem) => (problem = p),
  };
  let lastMessageId = "";
  let totalIn = 0;
  let totalOut = 0;
  let cacheRead = 0;

  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const stream = anthropic.messages.stream(
      {
        model: TUTOR_MODEL,
        max_tokens: 8192,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        cache_control: { type: "ephemeral" },
        system: [{ type: "text", text: buildSystemPrompt(problem, session) }],
        tools: TOOLS,
        messages: convo,
      },
      { signal },
    );

    for await (const ev of stream) {
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
        yield { type: "text", delta: ev.delta.text };
      } else if (ev.type === "content_block_start" && ev.content_block.type === "tool_use") {
        yield { type: "tool_start", name: ev.content_block.name };
      }
    }

    const msg = await stream.finalMessage();
    lastMessageId = msg.id;
    totalIn += msg.usage.input_tokens;
    totalOut += msg.usage.output_tokens;
    cacheRead += msg.usage.cache_read_input_tokens ?? 0;

    await db.insert(messages).values({ sessionId: session.id, role: "assistant", content: msg.content });
    convo.push({ role: "assistant", content: msg.content });

    if (msg.stop_reason === "refusal") {
      yield { type: "error", message: "The tutor declined to answer that." };
      break;
    }
    if (msg.stop_reason === "pause_turn") continue;
    if (msg.stop_reason !== "tool_use") break;

    const toolUses = msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      const r = await executeTool(tu.name, tu.input, ctx);
      results.push({ type: "tool_result", tool_use_id: tu.id, content: r.content, is_error: r.isError });
      while (queue.length) yield queue.shift()!;
    }
    await db.insert(messages).values({ sessionId: session.id, role: "user", content: results, displayText: null });
    convo.push({ role: "user", content: results });
  }

  // 4. Bookkeeping.
  await db
    .update(sessions)
    .set({ updatedAt: new Date(), ...(editorSet ? { code: editorSet } : {}) })
    .where(eq(sessions.id, session.id));

  if (process.env.NODE_ENV !== "production") {
    console.log(`[tutor] in=${totalIn} out=${totalOut} cacheRead=${cacheRead}`);
  }
  yield { type: "done", messageId: lastMessageId, usage: { input: totalIn, output: totalOut, cacheRead } };
}

/* ------------------------------------------------------------------ */

function buildUserContent(input: TurnInput, memories: string | null): Anthropic.ContentBlockParam[] {
  const ctx: string[] = [];

  if (memories) {
    ctx.push(`<memories note="what you remember about this learner from past sessions">\n${memories}\n</memories>`);
  }
  if (input.board) {
    const { shapes, total, viewport } = input.board;
    const list = shapes.length
      ? shapes.map((s) => JSON.stringify(s)).join("\n")
      : "(empty)";
    ctx.push(`<board viewport="${JSON.stringify(viewport)}" total_shapes="${total}">\n${list}\n</board>`);
  }
  if (input.code) {
    const numbered = input.code.source
      ? input.code.source
          .split("\n")
          .map((l, i) => `${String(i + 1).padStart(3, " ")}| ${l}`)
          .join("\n")
      : "(empty)";
    ctx.push(`<editor language="${input.code.language}" note="line numbers are for reference only, not part of the code">\n${numbered}\n</editor>`);
  }
  if (input.lastRun) {
    const r = input.lastRun;
    const summary = {
      ok: r.ok,
      error: r.error,
      passed: r.tests.filter((t) => t.passed).length,
      total: r.tests.length,
      failures: r.tests.filter((t) => !t.passed).slice(0, 3).map((t) => ({ name: t.name, expected: t.expected, actual: t.actual, error: t.error?.slice(0, 300) })),
      stdout: r.stdout.slice(0, 500),
      stderr: r.stderr.slice(0, 300),
    };
    ctx.push(`<last_run language="${r.language}">\n${JSON.stringify(summary)}\n</last_run>`);
  }

  const text = ctx.length ? `<context>\n${ctx.join("\n")}\n</context>\n\n${input.text}` : input.text;
  return [{ type: "text", text }];
}
