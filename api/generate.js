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
 *
 * Groq is detected from the key prefix (gsk_…), so setting AI_API_KEY alone is
 * enough — the base URL and a current model are chosen for you. Retired Groq
 * model IDs are mapped to their replacement, and the marketing site is
 * corrected to the real API host, so a stale tutorial value can't 404 the app.
 * ---------------------------------------------------------------------------
 */

import { currentUser } from "./_lib/auth.js";
import { ensureSchema, hasDatabase, query } from "./_lib/db.js";
import { readBody, send } from "./_lib/http.js";

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

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const OPENAI_BASE_URL = "https://api.openai.com/v1";

/* Groq retired these IDs (see console.groq.com/docs/deprecations). */
const RETIRED_GROQ_MODELS = {
  "llama3-8b-8192": "openai/gpt-oss-20b",
  "llama3-70b-8192": "openai/gpt-oss-120b",
  "llama-3.1-8b-instant": "openai/gpt-oss-20b",
  "llama-3.3-70b-versatile": "openai/gpt-oss-120b",
};

/**
 * Accept the shapes people actually paste — the marketing site, the bare API
 * host, a full /chat/completions URL — and reduce them to the base URL that
 * `${baseUrl}/chat/completions` needs. Every wrong shape here is a silent 404.
 */
function normalizeBaseUrl(raw, isGroq) {
  let url = String(raw || "")
    .trim()
    .replace(/\/+$/, "");
  if (!url) url = isGroq ? GROQ_BASE_URL : OPENAI_BASE_URL;

  url = url.replace(/\/chat\/completions$/i, "");
  if (/^https?:\/\/(www\.|console\.|api\.)?groq\.com(\/.*)?$/i.test(url)) {
    return GROQ_BASE_URL;
  }
  return url;
}

/** Read at call time so env vars set after import still work. */
function aiConfig() {
  const key = String(process.env.AI_API_KEY || process.env.GROQ_API_KEY || "").trim();
  const isGroq = /^gsk_/i.test(key);
  const chosen = String(
    process.env.AI_MODEL || (isGroq ? "openai/gpt-oss-20b" : "gpt-4o-mini"),
  ).trim();

  return {
    key,
    baseUrl: normalizeBaseUrl(process.env.AI_BASE_URL, isGroq),
    model: (isGroq && RETIRED_GROQ_MODELS[chosen]) || chosen,
  };
}

/* send() and readBody() live in api/_lib/http.js, shared with the other routes. */

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

/** Pull the assistant text out of a chat-completions payload. */
function readContent(payload) {
  const message = payload?.choices?.[0]?.message?.content;
  if (Array.isArray(message)) {
    return message.map((part) => (typeof part === "string" ? part : part?.text || "")).join("");
  }
  if (typeof message === "string") return message;
  return payload?.choices?.[0]?.text || "";
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

  /* Accounts are optional. With no database configured the app still works in
     guest mode; once DATABASE_URL exists, generating costs one credit. If the
     account lookup itself breaks, we keep generating rather than take the whole
     feature down over a database hiccup. */
  let gating = false;
  let user = null;
  if (hasDatabase()) {
    try {
      await ensureSchema();
      user = await currentUser(req);
      gating = true;
    } catch (err) {
      console.error("[generate] accounts unavailable, serving as guest:", err?.message || err);
    }
  }

  if (gating) {
    if (!user) {
      return send(res, 401, {
        error: "Sign in to generate captions.",
        code: "auth_required",
      });
    }
    if (user.credits < 1) {
      return send(res, 402, {
        error: "You're out of credits — buy more to keep generating.",
        code: "no_credits",
      });
    }
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

  /* Groq's gpt-oss / qwen models spend part of max_tokens on hidden reasoning,
     which can eat the whole budget and return an empty caption. Ask for light
     reasoning where the model supports it. */
  const tunable = /api\.groq\.com/.test(baseUrl) && /gpt-oss|qwen/i.test(model);

  async function ask() {
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
        max_tokens: 1600,
        ...(tunable ? { reasoning_effort: "low" } : {}),
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

    return { upstream, payload: await upstream.json().catch(() => null) };
  }

  try {
    let { upstream, payload } = await ask();

    if (!upstream.ok) {
      const detail =
        payload?.error?.message || payload?.message || `Provider returned ${upstream.status}.`;

      if (upstream.status === 401 || upstream.status === 403) {
        return send(res, 502, {
          error: `The AI provider rejected your key (${upstream.status}). Check AI_API_KEY and that it matches AI_BASE_URL.`,
        });
      }
      if (upstream.status === 404 && /model/i.test(detail)) {
        return send(res, 502, {
          error: `The AI provider doesn't recognise the model "${model}". Set AI_MODEL to one it offers — Groq's current free models include openai/gpt-oss-20b.`,
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

    let variants = normalizeVariants(readContent(payload));

    /* Reasoning models occasionally answer with nothing but thinking. One
       silent retry is cheaper for the user than an error. */
    if (variants.length === 0 && !controller.signal.aborted) {
      const second = await ask();
      if (second.upstream.ok) {
        const retried = normalizeVariants(readContent(second.payload));
        if (retried.length > 0) {
          variants = retried;
          payload = second.payload;
        }
      }
    }

    if (variants.length === 0) {
      return send(res, 502, { error: "The AI returned an empty caption. Try rephrasing the topic." });
    }

    /* Charge only for a caption the user actually gets. */
    let credits = null;
    if (gating && user) {
      try {
        const spent = await query(
          "update app_users set credits = credits - 1 where id = $1 and credits > 0 returning credits",
          [user.id],
        );
        credits = spent.rows[0] ? Number(spent.rows[0].credits) : 0;
      } catch (err) {
        console.error("[generate] couldn't charge a credit:", err?.message || err);
      }
    }

    return send(res, 200, {
      variants,
      model,
      usage: payload?.usage || null,
      ...(credits === null ? {} : { credits }),
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
