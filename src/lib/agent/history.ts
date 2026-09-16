import type Anthropic from "@anthropic-ai/sdk";
import type { Message } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/store/workspace-store";

type Param = Anthropic.MessageParam;

/** DB rows → API message params (content blocks were stored verbatim). */
export function toMessageParams(rows: Message[]): Param[] {
  return rows.map((r) => ({ role: r.role, content: r.content as Param["content"] }));
}

/** DB rows → what the chat panel renders. Tool-result-only user turns are hidden. */
export function toDisplayMessages(rows: Message[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  let bridging = false; // true while walking assistant → tool_result → assistant chains
  for (const r of rows) {
    if (r.role === "user") {
      if (r.displayText) {
        out.push({ id: r.id, role: "user", text: r.displayText });
        bridging = false;
      } else {
        bridging = true;
      }
      continue;
    }
    const blocks = Array.isArray(r.content) ? (r.content as Anthropic.ContentBlock[]) : [];
    const text = blocks
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    const tools = blocks
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
      .map((b) => b.name);
    const last = out[out.length - 1];
    if (bridging && last?.role === "assistant") {
      last.text += (last.text && text ? "\n\n" : "") + text;
      last.tools = [...(last.tools ?? []), ...tools];
    } else {
      out.push({ id: r.id, role: "assistant", text, tools });
    }
    bridging = false;
  }
  return out;
}
