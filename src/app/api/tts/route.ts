import { z } from "zod";
import { getAudioClient, hasServerVoice } from "@/lib/voice/openai";

const bodySchema = z.object({ text: z.string().min(1).max(2000) });

/** Text-to-speech; returns audio/mpeg. */
export async function POST(req: Request) {
  if (!hasServerVoice()) return Response.json({ error: "Server speech disabled (no OPENAI_API_KEY); use browser speech" }, { status: 501 });
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: z.prettifyError(parsed.error) }, { status: 400 });

  const speech = await getAudioClient().audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "alloy",
    input: stripMarkdown(parsed.data.text),
    response_format: "mp3",
    instructions: "Warm, clear, unhurried tutor voice. Read code identifiers naturally.",
  });
  return new Response(speech.body, { headers: { "content-type": "audio/mpeg", "cache-control": "no-store" } });
}

function stripMarkdown(s: string) {
  return s
    .replace(/```[\s\S]*?```/g, " code block omitted. ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_#>]+/g, "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}
