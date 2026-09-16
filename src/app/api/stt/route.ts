import { getAudioClient, hasServerVoice } from "@/lib/voice/openai";

/** Whisper transcription. Body: multipart form with an `audio` file. */
export async function POST(req: Request) {
  if (!hasServerVoice()) return Response.json({ error: "Server speech disabled (no OPENAI_API_KEY); use browser speech" }, { status: 501 });
  const form = await req.formData();
  const audio = form.get("audio");
  if (!(audio instanceof File)) return Response.json({ error: "audio file required" }, { status: 400 });
  if (audio.size > 25 * 1024 * 1024) return Response.json({ error: "audio too large" }, { status: 413 });

  const result = await getAudioClient().audio.transcriptions.create({
    model: "whisper-1",
    file: audio,
    language: "en",
    prompt: "Coding interview: arrays, hash maps, binary search, BFS, DFS, dynamic programming, Big O, system design, load balancer, cache, database.",
  });
  return Response.json({ text: result.text });
}
