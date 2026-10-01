export const AIRA_VERSION = "2.3.10-rc";

export const PROVIDERS = Object.freeze({
  groq: Object.freeze({ name: "Groq", url: "https://api.groq.com/openai/v1/chat/completions", keyName: "aira_api_key" }),
  openrouter: Object.freeze({ name: "OpenRouter", url: "https://openrouter.ai/api/v1/chat/completions", keyName: "aira_openrouter_key" }),
});

export const GROQ_URL = PROVIDERS.groq.url;
export const MAX_ITERATIONS = 16;
export const AVAILABLE_MODELS = Object.freeze([
  Object.freeze({ id: "openai/gpt-oss-120b", name: "GPT-OSS 120B", provider: "groq", aliases: ["gpt oss 120b", "gpt-oss", "gptoss", "gpt oss"] }),
  Object.freeze({ id: "openai/gpt-oss-20b", name: "GPT-OSS 20B", provider: "groq", aliases: ["gpt oss 20b"] }),
  // llama-3.1-8b-instant + llama-3.3-70b-versatile were shut down for free/dev keys on 2026-08-16.
  Object.freeze({ id: "poolside/laguna-xs-2.1:free", name: "Laguna XS 2.1 (free)", provider: "openrouter", tools: true, aliases: ["laguna", "laguna xs", "poolside", "laguna xs 2.1"] }),
  Object.freeze({ id: "nvidia/nemotron-3-super-120b-a12b:free", name: "Nemotron 3 Super (free)", provider: "openrouter", tools: true, aliases: ["nemotron", "nemotron super", "nemotron 3", "nvidia", "nemotron 3 super"] }),
  // Gemma remains chat-only here because its free route can reject AIRA's full local tool bundle.
  Object.freeze({ id: "google/gemma-4-31b-it:free", name: "Gemma 4 31B (free)", provider: "openrouter", tools: false, aliases: ["gemma", "gemma 4", "gemma 31b", "google gemma", "gemma 4 31b"] }),
  // Qwen3.8 27B free: dense reasoning VLM, function calling supported, free route is rate limited.
  Object.freeze({ id: "qwen/qwen3.8-27b:free", name: "Qwen3.8 27B (free)", provider: "openrouter", tools: true, aliases: ["qwen", "qwen 3.8", "qwen3.8", "qwen 27b", "qwen3.8 27b"] }),
]);

export const DEFAULT_MODEL = "openai/gpt-oss-120b";
export const PROVIDER_DEFAULT_MODELS = Object.freeze({ groq: "openai/gpt-oss-120b", openrouter: "poolside/laguna-xs-2.1:free" });
export const RATE_LIMIT_PAUSE_MS = 1400;
export const FALLBACK_MODEL = "openai/gpt-oss-120b";
export const GPT_OSS_MODELS = new Set(["openai/gpt-oss-120b", "openai/gpt-oss-20b", "openai/gpt-oss-safeguard-20b"]);

export const AFTERDARK_ON_COMMAND = "/aira afterdark";
export const AFTERDARK_OFF_COMMAND = "/aira normal";
export const LOCKIN_COMMAND = /^\/(?:aira\s+)?lockin$/i;

export const AIRA_TASK_STATES = Object.freeze({
  idle: "idle", thinking: "thinking", working: "working", searching: "searching",
  waiting_for_input: "waiting_for_input", waiting_for_approval: "waiting_for_approval",
  error: "error", ratelimited: "ratelimited", finished: "finished", cancelled: "cancelled",
});

export const TASK_STATE_ICONS = Object.freeze({
  thinking: '<path d="M9 18h6M10 22h4M8.5 14.5a6 6 0 1 1 7 0c-.8.6-1.2 1.3-1.4 2.5H9.9c-.2-1.2-.6-1.9-1.4-2.5z"/>',
  working: '<path d="M4 12h4l2-7 4 14 2-7h4"/>',
  searching: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  waiting_for_input: '<path d="M5 5h14v10H9l-4 4z"/><path d="M9 9h.01M12 9h.01M15 9h.01"/>',
  waiting_for_approval: '<path d="M12 3 4 6v5c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6z"/><path d="m9 12 2 2 4-4"/>',
  error: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16h.01"/>',
  ratelimited: '<path d="M12 3a9 9 0 1 0 9 9"/><path d="M12 7v5l3 2"/>',
  finished: '<path d="m5 12 4 4L19 6"/>',
});

export const VOICE_MAX_MS = 180000;
export const VOICE_LABELS = Object.freeze({ ready: "Ready", listening: "Listening", processing: "Processing", speaking: "Speaking", error: "Error" });
export const VOICE_HINT = "\n\nThe user is talking to you by voice and your reply will be read aloud. Keep it short and conversational. Avoid tables, code blocks and long lists unless asked.";
