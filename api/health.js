/**
 * api/health.js — GET /api/health
 * ---------------------------------------------------------------------------
 * Lets the app tell you, before the first generation, whether the deployment
 * actually has an AI key attached — and which model it will call.
 * ---------------------------------------------------------------------------
 */

/* Keep in sync with api/generate.js. */
const RETIRED_GROQ_MODELS = {
  "llama3-8b-8192": "openai/gpt-oss-20b",
  "llama3-70b-8192": "openai/gpt-oss-120b",
  "llama-3.1-8b-instant": "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
};

function handler(req, res) {
  const key = String(process.env.AI_API_KEY || process.env.GROQ_API_KEY || "").trim();
  const isGroq = /^gsk_/i.test(key);
  const chosen = String(
    process.env.AI_MODEL || (isGroq ? "openai/gpt-oss-20b" : "gpt-4o-mini"),
  ).trim();

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(
    JSON.stringify({
      ok: true,
      hasKey: Boolean(key),
      model: (isGroq && RETIRED_GROQ_MODELS[chosen]) || chosen,
    })
  );
}

export default handler;
