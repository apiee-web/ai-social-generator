/**
 * api/generate.js — POST /api/generate
 * ---------------------------------------------------------------------------
 * One idea in, three channels out: LinkedIn, Instagram/Facebook and a TikTok /
 * Reels script. If the account has a Brand Vault profile, its context is
 * injected into the prompt so the user never repeats themselves.
 *
 * The AI key lives in the Vercel project's Environment Variables, so the
 * browser bundle never sees it. Any OpenAI-compatible provider works — switch
 * by setting AI_BASE_URL and AI_MODEL. Groq is detected from the key prefix
 * (gsk_…), so setting AI_API_KEY alone is enough.
 *
 * Billing: subscribers generate without limit; everyone else spends one of
 * their free starter credits per generation.
 * ---------------------------------------------------------------------------
 */

import { currentUser } from "./_lib/auth.js";
import { ensureSchema, hasDatabase, query } from "./_lib/db.js";
import { readBody, send } from "./_lib/http.js";
import { isSubscribed } from "./_lib/plans.js";

const AI_TIMEOUT_MS = 60000;
const MAX_TOPIC_LENGTH = 400;

const TONES = {
  friendly: "warm and friendly",
  bold: "bold and confident",
  witty: "witty and playful",
  professional: "polished and professional",
  inspirational: "uplifting and inspiring",
};

/* The anti-AI filter, spelled out. These are the tells readers notice first. */
const BANNED = [
  "in today's fast-paced world",
  "in the ever-evolving landscape",
  "delve",
  "tapestry",
  "game-changer",
  "game changer",
  "unlock",
  "unleash",
  "elevate",
  "seamless",
  "leverage",
  "revolutionary",
  "cutting-edge",
  "dive into",
  "let's dive in",
  "testament to",
  "it's not just",
  "foster",
  "robust",
  "empower",
  "synergy",
  "paradigm",
  "ever-changing",
];

/* -------------------------------------------------------------------------- */
/*  Provider plumbing                                                        */
/* -------------------------------------------------------------------------- */

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

/* -------------------------------------------------------------------------- */
/*  Prompt                                                                   */
/* -------------------------------------------------------------------------- */

function buildPrompt({ topic, tone, brand }) {
  const toneText = TONES[tone] || TONES.friendly;
  const truthy = (value) => Boolean(value && String(value).trim());

  const context = truthy(brand)
    ? [
        `Brand or creator: ${brand.name}`,
        `Audience: ${brand.audience}`,
        `Core offer / niche: ${brand.offer}`,
        `Brand tone of voice: ${TONES[brand.tone] || brand.tone}`,
      ]
    : ["No saved brand profile — stay concrete about the idea and avoid invented facts."];

  return [
    "You are a senior content strategist writing one idea for three channels at once.",
    "",
    "BRAND CONTEXT — fixed, never contradict it:",
    ...context.map((line) => `- ${line}`),
    "",
    `IDEA: ${topic}`,
    `Default tone: ${toneText}`,
    "",
    "Answer with exactly this JSON object and nothing else:",
    '{"linkedin":{"text":"..."},"instagram":{"text":"...","hashtags":["#one","#two"]},"tiktok":{"hook":"...","script":"..."}}',
    "",
    "LINKEDIN: a strong hook on its own first line, a short story or specific insight taken from the idea, then one clear call to action. 110-200 words, short paragraphs. No hashtags, no emojis, no markdown.",
    "INSTAGRAM / FACEBOOK: a scroll-stopping first line, 2-4 short paragraphs, one call to action. Put 5-8 relevant hashtags in the hashtags array, never inside text. Under 2,000 characters, at most one emoji.",
    "TIKTOK / REELS: \"hook\" is the first three seconds — the visual action plus the spoken line, at most 20 words. \"script\" is the spoken script, 90-150 words, with natural beats and a closing line. No hashtags, no emojis, no camera directions past the hook.",
    "",
    "VOICE RULES — strict:",
    "- Sound like one specific human with first-hand knowledge: concrete details, plain words, sentences of different lengths.",
    `- Never use these words or phrases: ${BANNED.map((word) => `"${word}"`).join(", ")}.`,
    "- No emojis, except at most one in the Instagram caption.",
    "- No hashtags in LinkedIn or TikTok, ever.",
    "- No bullet-point emoji lists, no \"Here's the thing\", no \"Ever wondered…\" openers, no \"And that's why\" endings.",
    "- Never invent statistics, prices, client names or testimonials that are not in the brief.",
    "- JSON only.",
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

function cleanTags(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .map((tag) => (/^#/.test(tag) ? tag : `#${tag.replace(/^#+/g, "")}`))
    .slice(0, 12);
}

/** Turn whatever the model said into the three channels, or null. */
export function normalizeChannels(content) {
  const parsed = extractJson(content);
  if (!parsed || typeof parsed !== "object") return null;

  const part = (key) => (parsed[key] && typeof parsed[key] === "object" ? parsed[key] : {});
  const text = (value) => String(value?.text ?? value?.caption ?? "").trim();

  const linkedin = text(part("linkedin"));
  const instagram = text(part("instagram"));
  const tiktokPart = part("tiktok");
  const hook = String(tiktokPart.hook ?? tiktokPart.visual_hook ?? "").trim();
  const script = String(tiktokPart.script ?? tiktokPart.text ?? "").trim();

  if (!linkedin && !instagram && !script) return null;

  return {
    linkedin: { text: linkedin },
    instagram: { text: instagram, hashtags: cleanTags(part("instagram").hashtags) },
    tiktok: { hook, script },
  };
}

/** Pull the assistant text out of a chat-completions payload. */
function readContent(payload) {
  const message = payload?.choices?.[0]?.message?.content;
  if (Array.isArray(message)) {
    return message.map((piece) => (typeof piece === "string" ? piece : piece?.text || "")).join("");
  }
  if (typeof message === "string") return message;
  return payload?.choices?.[0]?.text || "";
}

/** The saved brand profile to write in, if the account has one. */
async function loadBrand(userId, brandId) {
  if (!userId) return null;
  const wanted = String(brandId || "").trim();
  const { rows } = wanted
    ? await query(
        "select id, name, audience, offer, tone from brand_vaults where id = $1 and user_id = $2",
        [wanted, userId],
      )
    : await query(
        "select id, name, audience, offer, tone from brand_vaults where user_id = $1 order by updated_at desc limit 1",
        [userId],
      );
  return rows[0] || null;
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
  const tone = String(body.tone || "").trim().toLowerCase() || "friendly";
  const brandId = String(body.brandId || "").trim();

  if (!topic) return send(res, 400, { error: "Send an idea for the content." });
  if (topic.length > MAX_TOPIC_LENGTH) {
    return send(res, 400, { error: `Keep the idea under ${MAX_TOPIC_LENGTH} characters.` });
  }
  if (body.tone && !TONES[tone]) {
    return send(res, 400, { error: `Unknown tone "${tone}".` });
  }

  /* Accounts are optional. With no database the app still works in guest mode;
     once DATABASE_URL exists, generation is gated by plan. */
  let gating = false;
  let user = null;
  let brand = null;
  if (hasDatabase()) {
    try {
      await ensureSchema();
      user = await currentUser(req);
      gating = true;
      if (user) brand = await loadBrand(user.id, brandId);
    } catch (err) {
      console.error("[generate] accounts unavailable, serving as guest:", err?.message || err);
    }
  }

  let unlimited = false;
  if (gating) {
    if (!user) {
      return send(res, 401, { error: "Sign in to generate content.", code: "auth_required" });
    }
    unlimited = isSubscribed(user.plan, user.subscriptionStatus);
    if (!unlimited && user.credits < 1) {
      return send(res, 402, {
        error: "You've used your free generations — upgrade to keep going.",
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

  const effectiveTone = brand?.tone || tone;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
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
        temperature: 0.8,
        max_tokens: 2000,
        ...(tunable ? { reasoning_effort: "low" } : {}),
        messages: [
          {
            role: "system",
            content:
              "You are an expert multi-channel content strategist. You always answer with valid JSON and nothing else.",
          },
          { role: "user", content: buildPrompt({ topic, tone: effectiveTone, brand }) },
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

    let channels = normalizeChannels(readContent(payload));

    /* Reasoning models occasionally answer with nothing but thinking. One
       silent retry is cheaper for the user than an error. */
    if (!channels && !controller.signal.aborted) {
      const second = await ask();
      if (second.upstream.ok) {
        const retried = normalizeChannels(readContent(second.payload));
        if (retried) {
          channels = retried;
          payload = second.payload;
        }
      }
    }

    if (!channels) {
      return send(res, 502, {
        error: "The AI sent back an empty answer. Try rephrasing the idea.",
      });
    }

    /* Subscribers are unlimited; everyone else spends one free credit. */
    let credits = null;
    if (gating && user && !unlimited) {
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
      channels,
      brand: brand
        ? { id: brand.id, name: brand.name, audience: brand.audience, offer: brand.offer, tone: brand.tone }
        : null,
      unlimited,
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
export { buildPrompt };
