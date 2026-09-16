import { getEmbeddingsClient } from "@/lib/voice/openai";

// text-embedding-3-small → 1536 dims, matches `memories.embedding` in the schema.
export async function embed(text: string): Promise<number[]> {
  const { client, model } = getEmbeddingsClient();
  const res = await client.embeddings.create({ model, input: text.slice(0, 8000) });
  return res.data[0].embedding;
}
