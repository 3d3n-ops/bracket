# bracket

Coding-interview practice on a whiteboard. The main surface is an infinite canvas (tldraw); a translucent, draggable chat panel talks to an AI tutor (Claude) that can **see and draw on the board**, write into your editor, and remember you across sessions. A right sidebar slides open to half the screen with a CodeMirror editor that runs JavaScript (Web Worker) and Python (Pyodide) entirely in the browser. Voice in/out via Whisper + TTS.

## Stack

- Next.js 16 (App Router) · React 19 · Tailwind 4
- tldraw 5 + `@tldraw/mermaid` — canvas; the tutor draws boxes/arrows/arrays and full Mermaid architecture diagrams
- `@anthropic-ai/sdk` — tutor agent (Claude Opus 5, streaming, tool use, prompt caching) — direct or through OpenRouter
- Neon Postgres + Drizzle — problems, sessions, transcripts; **pgvector** for the tutor's long-term memory
- OpenAI — Whisper STT, TTS, and embeddings only (never the LLM)
- Pyodide 0.28 + Web Workers — in-browser code execution with a test harness (0.28 is the last Pyodide that loads in the classic workers Turbopack emits)

## Setup

```bash
pnpm install
cp .env.example .env.local   # fill in the keys below
pnpm db:push                 # enables pgvector + creates tables
pnpm db:seed                 # loads the problem bank
pnpm dev
```

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon connection string (free tier works; pgvector is enabled automatically) |
| `OPENROUTER_API_KEY` | Tutor LLM (`anthropic/claude-opus-5` via OpenRouter's Anthropic-compatible endpoint) **and** embeddings (`openai/text-embedding-3-small`) |
| `ANTHROPIC_API_KEY` | Optional — if set, the tutor talks to Anthropic directly instead of OpenRouter |
| `OPENAI_API_KEY` | Optional — enables Whisper STT + OpenAI TTS. Without it the browser's built-in speech recognition / synthesis is used (OpenRouter has no audio endpoints) |

## Using it

- **Dashboard** (`/`):
  - **Learn anything** — type a topic (or hit *Surprise me*) and the tutor opens the conversation, gauges what you know, teaches on the board, then creates a hands-on exercise with real tests (`set_exercise`).
  - **LeetCode** — search free problems, or start today's daily challenge. Imports use LeetCode's official starter code, derive the entry function and linked-list/tree conversions from its `metaData`, and turn the worked examples into tests. The tutor can also do this itself mid-conversation (`leetcode_search` / `leetcode_import` / `leetcode_daily`).
  - Built-in problem bank (DSA + system design) and freestyle sessions.
- **Workspace** (`/session/:id`):
  - Draw anything on the board; the tutor sees a compact description of every shape.
  - Chat panel: drag by its header, resize from the corner. `⌘K` focuses it.
  - `🎤 talk` (or hold **Space**) records; **voice mode** auto-sends transcripts and reads replies aloud (sentence-by-sentence, so audio starts early).
  - `Code` / `⌘B` opens the editor. `⌘↵` runs tests. Results are shown and also handed to the tutor on your next message.
  - **End session** extracts what the tutor learned about you into memory and writes a summary.

## Layout

```
src/
  app/            routes: dashboard, session workspace, API (chat SSE, sessions, attempts, stt, tts)
  components/     board (tldraw + op applier + snapshot), chat (floating panel, voice), editor (CodeMirror, output), dashboard
  lib/agent/      Claude client, system prompt (mode-aware), tools, streaming loop, SSE events
  lib/leetcode/   GraphQL client + importer (LeetCode problem → our problem schema)
  lib/board/      zod contract for tutor drawing ops (shared by server + client)
  lib/runner/     JS + Pyodide workers, preludes (ListNode/TreeNode), deep-equal
  lib/memory/     embeddings, pgvector retrieval, session-end extraction
  lib/voice/      OpenAI client, recorder + TTS queue hooks
  lib/db/         Drizzle schema, seed
  content/        problem bank (DSA + system design)
```

## LeetCode: API, not MCP

LeetCode has no official API, but its public GraphQL endpoint (`leetcode.com/graphql`) serves problem search, statements, `metaData`, code snippets and the daily challenge without auth (premium statements are hidden). An MCP server would only wrap that same endpoint — and Anthropic's hosted MCP connector isn't available through OpenRouter — so the integration calls GraphQL directly (`src/lib/leetcode/`).

## How the tutor draws

Each user turn carries `<context>` (board shapes, editor code, last run result). The tutor replies with text and may call `draw_on_board` with a small op vocabulary (`add_box`, `add_arrow`, `add_array`, `draw_mermaid`, …). The server validates ops, streams them to the browser as SSE events, and the client applies them to tldraw. Re-issuing an op with the same id updates the shape, which is how the tutor "steps" an array walkthrough.
