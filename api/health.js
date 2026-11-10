/**
 * api/health.js — GET /api/health
 * ---------------------------------------------------------------------------
 * Lets the app tell you, before the first generation, whether the deployment
 * actually has an AI key attached.
 * ---------------------------------------------------------------------------
 */

function handler(req, res) {
  const hasKey = Boolean(String(process.env.AI_API_KEY || "").trim());

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(
    JSON.stringify({
      ok: true,
      hasKey,
      model: String(process.env.AI_MODEL || "gpt-4o-mini").trim(),
    })
  );
}

export default handler;
