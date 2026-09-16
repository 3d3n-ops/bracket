import type { BoardOp } from "@/lib/board/ops";
import type { EditorState, Problem } from "@/lib/db/schema";
import type { CodeAnnotation } from "@/lib/editor/annotations";

/** Server → client events streamed over SSE from `POST /api/chat`. */
export type ChatEvent =
  | { type: "text"; delta: string }
  | { type: "tool_start"; name: string }
  | { type: "board_ops"; ops: BoardOp[] }
  | { type: "editor_set"; editor: EditorState }
  /** The session's active problem changed (tutor exercise or LeetCode import). */
  | { type: "exercise_set"; problem: Problem; language?: EditorState["language"] }
  /** Tutor review notes pinned to editor lines (replaces the previous set). */
  | { type: "annotations"; items: CodeAnnotation[] }
  | { type: "done"; messageId: string; usage?: { input: number; output: number; cacheRead: number } }
  | { type: "error"; message: string };

export function encodeEvent(e: ChatEvent): string {
  return `data: ${JSON.stringify(e)}\n\n`;
}

/** Incrementally parses an SSE byte stream into ChatEvents. */
export async function* readEvents(res: Response): AsyncGenerator<ChatEvent> {
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = raw.split("\n").find((l) => l.startsWith("data: "));
      if (line) yield JSON.parse(line.slice(6)) as ChatEvent;
    }
  }
}
