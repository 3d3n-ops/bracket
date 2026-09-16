import Anthropic from "@anthropic-ai/sdk";

/**
 * Tutor LLM client. Uses the Anthropic API directly when ANTHROPIC_API_KEY is
 * set; otherwise routes through OpenRouter's Anthropic-compatible endpoint
 * (same Messages API, model ids are prefixed with `anthropic/`).
 */
const direct = !!process.env.ANTHROPIC_API_KEY;

export const anthropic = direct
  ? new Anthropic()
  : new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: "https://openrouter.ai/api",
      defaultHeaders: { "HTTP-Referer": "https://github.com/bracket-ai", "X-Title": "bracket" },
    });

export const TUTOR_MODEL = direct ? "claude-opus-5" : "anthropic/claude-opus-5";
