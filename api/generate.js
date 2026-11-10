
/**
 * api/generate.js — POST /api/generate
 * ---------------------------------------------------------------------------
 * Vercel turns every file inside /api into its own endpoint, so this file is
 * what the frontend's fetch("/api/generate") hits in production. On a static
 * host there is no /api, which is why generate used to 404.
 *
 * The AI key lives in the Vercel project's Environment Variables, so the
 * browser bundle never sees it. Any OpenAI-compatible provider works — switch
 * by setting AI_BASE_URL and AI_MODEL (OpenAI, Groq, Together, OpenRouter,
 * DeepSeek, …). Nothing here needs installing: only Node built-ins are used.
 * ---------------------------------------------------------------------------
 */

const AI_TIMEOUT_MS = 45000;
const MAX_TOPIC_LENGTH = 400;

/* Keep these tables in sync with src/App.jsx. */
const PLATFORMS = {
  instagram: {
    label: "Instagram",
    limit: 2200,
    guidance: "Visual, warm, line breaks for readability, hashtags at the end.",
  },
  x: { label: "X / Twitter", limit: 280, guidance: "One sharp idea, no fluff, at most 2 hashtags." },
  linkedin: {
    label: "LinkedIn",
    limit: 3000,
    guidance: "Professional but human, short paragraphs, a takeaway or lesson.",
  },
  tiktok: {
    label: "TikTok",
    limit: 2200,
    guidance: "Hook in the first 5 words, casual voice, trend-aware.",
  },
  facebook: {
    label: "Facebook",
    limit: 63206,
    guidance: "Conversational, invite a reply, light on hashtags.",
  },
};

const TONES = {
  friendly: "warm and friendly",
  bold: "bold and confident",
  witty: "witty and playful",
  professional: "polished and professional",
  inspirational: "uplifting and inspiring",
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                  */
/* -------------------------------------------------------------------------- */

/** Read at call time so env vars set after import still work. */
function aiConfig() {
  return {
    key: String(process.env.AI_API_KEY || "").trim(),
    baseUrl: String(process.env.AI_BASE_URL || "https://api.openai.com/v1")
      .trim()
      .replace(/\/+$/, ""),
    model: String(process.env.AI_MODEL || "gpt-4o-mini").trim(),
  };
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

/**
 * Vercel usually parses the JSON body for us, but `vercel dev`, Express and
 * plain `node` all differ — so fall back to reading the raw stream.
 */
async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }

  const chunks = [];
  try {
    for await (const chunk of req) chunks.push(chunk);
  } catch {
    return {};
  }
  if (chunks.length === 0) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

function buildPrompt({ topic, platform, tone, count }) {
  const target = PLATFORMS[platform];
  const toneText = TONES[tone];

  return [
    `You are a senior social media copywriter. Write ${count} distinct ${target.label} captions.`,
    "",
    `Topic: ${topic}`,
    `Tone: ${toneText}`,
    `Platform style: ${target.guidance}`,
    `Hard limit: each caption must be ${target.limit} characters or fewer, hashtags included.`,
    "",
    "Rules:",
    "- Open with a scroll-stopping first line.",
    "- Give each option a different angle (question, story, bold claim, tip, etc.).",
    "- Maximum 2 emoji per caption.",
    "- No numbering or labels inside the caption text.",
    "- 3 to 6 relevant hashtags per caption.",
    "",
    "Reply with JSON only, exactly in this shape:",
    '{"variants":[{"text":"the caption body","hashtags":["#one","#two"]}]}',
  ].join("\n");
}

/** Models sometimes wrap JSON in prose or code fences. Dig it out. */
function extractJson(raw) {
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

function normalizeVariants(content) {
  const parsed = extractJson(content);
  const list =
    Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.variants) ? parsed.variants : null;

  const cleaned = (list || [])
    .map((item) => {
      if (typeof item === "string") return { text: item.trim(), hashtags: [] };
      if (!item || typeof item !== "object") return null;
      const text = String(item.text ?? item.caption ?? "").trim();
      if (!text) return null;
      const hashtags = Array.isArray(item.hashtags)
        ? item.hashtags.map((tag) => String(tag).trim()).filter(Boolean)
        : [];
      return { text, hashtags };
    })
    .filter(Boolean)
    .slice(0, 4);

  if (cleaned.length > 0) return cleaned;

  /* Fallback: the model ignored the JSON instruction. Keep its prose. */
  const fallbackText = String(content || "").trim();
  return fallbackText ? [{ text: fallbackText, hashtags: [] }] : [];
}

/* -------------------------------------------------------------------------- */
/*  Handler                                                                  */
/* -------------------------------------------------------------------------- */

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Use POST for this endpoint." });
  }

  const body = await readBody(req);
  const topic = String(body.topic || "").trim();
  const platform = String(body.platform || "instagram");
  const tone = String(body.tone || "friendly");
  const count = Math.min(3, Math.max(1, Number(body.count) || 3));

  if (!topic) {
    return send(res, 400, { error: "Send a topic for the post." });
  }
  if (topic.length > MAX_TOPIC_LENGTH) {
    return send(res, 400, { error: `Keep the topic under ${MAX_TOPIC_LENGTH} characters.` });
  }
  if (!PLATFORMS[platform]) {
    return send(res, 400, { error: `Unknown platform "${platform}".` });
  }
  if (!TONES[tone]) {
    return send(res, 400, { error: `Unknown tone "${tone}".` });
  }

  const { key, baseUrl, model } = aiConfig();
  if (!key) {
    return send(res, 503, {
      error:
        "No AI key on the server. Add AI_API_KEY to your environment variables (in Vercel: Settings → Environment Variables), then redeploy.",
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.85,
        max_tokens: 1200,
        messages: [
          {
            role: "system",
            content:
              "You are an expert social media copywriter. You always answer with valid JSON and nothing else.",
          },
          { role: "user", content: buildPrompt({ topic, platform, tone, count }) },
        ],
      }),
    });

    const payload = await upstream.json().catch(() => null);

    if (!upstream.ok) {
      const detail =
        payload?.error?.message || payload?.message || `Provider returned ${upstream.status}.`;

      if (upstream.status === 401 || upstream.status === 403) {
        return send(res, 502, {
          error: `The AI provider rejected your key (${upstream.status}). Check AI_API_KEY and that it matches AI_BASE_URL.`,
        });
      }
      if (upstream.status === 429) {
        return send(res, 429, {
          error:
            "The AI provider is rate-limiting you or your free quota ran out. Wait a moment or check your provider billing.",
        });
      }
      return send(res, 502, { error: `AI provider error: ${detail}` });
    }

    const message = payload?.choices?.[0]?.message?.content;
    const content = Array.isArray(message)
      ? message.map((part) => (typeof part === "string" ? part : part?.text || "")).join("")
      : typeof message === "string"
        ? message
        : payload?.choices?.[0]?.text || "";

    const variants = normalizeVariants(content);
    if (variants.length === 0) {
      return send(res, 502, { error: "The AI returned an empty caption. Try rephrasing the topic." });
    }

    return send(res, 200, {
      variants,
      model,
      usage: payload?.usage || null,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      return send(res, 504, { error: "The AI took too long to answer. Try again." });
    }
    const cause = err?.cause?.code || err?.code || "";
    return send(res, 502, {
      error: `Couldn't reach the AI provider${cause ? ` (${cause})` : ""}. Check AI_BASE_URL and your internet connection.`,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export default handler;
export { buildPrompt, normalizeVariants };
