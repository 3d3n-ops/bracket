import OpenAI from "openai";

/**
 * OpenAI-compatible clients — never used for the tutor LLM.
 *
 * - `getEmbeddingsClient()` prefers OpenRouter (works with the same key as the
 *   tutor) and falls back to OpenAI directly.
 * - `getAudioClient()` needs a real OPENAI_API_KEY: OpenRouter does not serve
 *   Whisper or TTS. When it's missing the app uses the browser's speech APIs.
 */
let embeddings: OpenAI | undefined;
let audio: OpenAI | undefined;

export const hasServerVoice = () => !!process.env.OPENAI_API_KEY;

export function getEmbeddingsClient(): { client: OpenAI; model: string } {
  if (!embeddings) {
    if (process.env.OPENROUTER_API_KEY) {
      embeddings = new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: "https://openrouter.ai/api/v1" });
      return { client: embeddings, model: "openai/text-embedding-3-small" };
    }
    if (!process.env.OPENAI_API_KEY) throw new Error("Set OPENROUTER_API_KEY or OPENAI_API_KEY for embeddings");
    embeddings = new OpenAI();
  }
  return { client: embeddings, model: process.env.OPENROUTER_API_KEY ? "openai/text-embedding-3-small" : "text-embedding-3-small" };
}

export function getAudioClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set — server-side speech unavailable");
  audio ??= new OpenAI();
  return audio;
}
