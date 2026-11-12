/**
 * api/_lib/ai.js
 * ---------------------------------------------------------------------------
 * The small amount of provider plumbing shared by the routes that talk to the
 * model: where to send the request, which model to ask for, and how to get the
 * assistant's text (or its JSON) back out of the payload.
 *
 * Any OpenAI-compatible provider works. Groq is detected from the key prefix
 * (gsk_…), so setting AI_API_KEY alone is enough; AI_BASE_URL and AI_MODEL
 * override the defaults.
 * ---------------------------------------------------------------------------
 */

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const OPENAI_BASE_URL = "https://api.openai.com/v1";

const RETIRED_GROQ_MODELS = {
  "llama3-8b-8192": "openai/gpt-oss-20b",
  "llama3-70b-8192": "openai/gpt-oss-120b",
  "llama-3.1-8b-instant": "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
};

function normalizeBaseUrl(raw, isGroq) {
  let url = String(raw || "").trim().replace(/\/+$/, "");
  if (!url) url = isGroq ? GROQ_BASE_URL : OPENAI_BASE_URL;

  url = url.replace(/\/chat\/completions$/i, "");
  if (/^https?:\/\/(www\.|console\.|api\.)?groq\.com(\/.*)?$/i.test(url)) {
    return GROQ_BASE_URL;
  }
  return url;
}

/** Read at call time so env vars set after import still work. */
export function aiConfig() {
  const key = String(process.env.AI_API_KEY || process.env.GROQ_API_KEY || "").trim();
  const isGroq = /^gsk_/i.test(key);
  const chosen = String(
    process.env.AI_MODEL || (isGroq ? "openai/gpt-oss-20b" : "gpt-4o-mini"),
  ).trim();

  return {
    key,
    baseUrl: normalizeBaseUrl(process.env.AI_BASE_URL, isGroq),
    model: (isGroq && RETIRED_GROQ_MODELS[chosen]) || chosen,
    tunable: /api\.groq\.com/.test(normalizeBaseUrl(process.env.AI_BASE_URL, isGroq)),
  };
}

/** Models sometimes wrap JSON in prose or code fences. Dig it out. */
export function extractJson(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;

  const unfenced = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(unfenced);
  } catch {
    /* keep digging */
  }

  const first = unfenced.indexOf("{");
  const last = unfenced.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(unfenced.slice(first, last + 1));
    } catch {
      /* give up below */
    }
  }
  return null;
}

/** Pull the assistant text out of a chat-completions payload. */
export function readContent(payload) {
  const message = payload?.choices?.[0]?.message?.content;
  if (Array.isArray(message)) {
    return message.map((piece) => (typeof piece === "string" ? piece : piece?.text || "")).join("");
  }
  if (typeof message === "string") return message;
  return payload?.choices?.[0]?.text || "";
}

/**
 * One chat-completion call. `json` asks providers that support it for a strict
 * JSON object; the reply is still parsed defensively either way.
 */
export async function chat({ config, system, user, maxTokens = 900, temperature = 0.5, json = false }) {
  const { key, baseUrl, model, tunable } = config;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature,
        max_tokens: maxTokens,
        ...(tunable && /gpt-oss|qwen/i.test(model) ? { reasoning_effort: "low" } : {}),
        ...(json && /api\.openai\.com/.test(baseUrl) ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    const payload = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, payload, text: readContent(payload) };
  } finally {
    clearTimeout(timeout);
  }
}
