/**
 * server.cjs — the backend for App.jsx
 * ---------------------------------------------------------------------------
 * Why this file exists: an AI API key must never ship in a React bundle. The
 * browser calls /api/generate here, and this file calls the AI provider with
 * the key held in .env.
 *
 * Run:  node server.cjs        (needs Node 18+ and `npm i express dotenv`)
 * ---------------------------------------------------------------------------
 */

const express = require("express");
const path = require("node:path");

try {
  require("dotenv").config();
} catch {
  /* dotenv is optional if you set env vars another way */
}

const app = express();
app.use(express.json({ limit: "256kb" }));

const PORT = Number(process.env.PORT || 8787);
const AI_API_KEY = process.env.AI_API_KEY || "";
const AI_BASE_URL = (process.env.AI_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
const AI_MODEL = process.env.AI_MODEL || "gpt-4o-mini";
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "";

/* -------------------------------------------------------------------------- */
/*  Validation tables — keep these in sync with App.jsx                      */
/* -------------------------------------------------------------------------- */

const PLATFORMS = {
  instagram: { label: "Instagram", limit: 2200, guidance: "Visual, warm, line breaks for readability, hashtags at the end." },
  x: { label: "X / Twitter", limit: 280, guidance: "One sharp idea, no fluff, at most 2 hashtags." },
  linkedin: { label: "LinkedIn", limit: 3000, guidance: "Professional but human, short paragraphs, a takeaway or lesson." },
  tiktok: { label: "TikTok", limit: 2200, guidance: "Hook in the first 5 words, casual voice, trend-aware." },
  facebook: { label: "Facebook", limit: 63206, guidance: "Conversational, invite a reply, light on hashtags." },
};

const TONES = {
  friendly: "warm and friendly",
  bold: "bold and confident",
  witty: "witty and playful",
  professional: "polished and professional",
  inspirational: "uplifting and inspiring",
};

const PLANS = {
  starter: { credits: 50 },
  pro: { credits: 250 },
  agency: { credits: 1000 },
};

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                  */
/* -------------------------------------------------------------------------- */

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
  const list = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.variants) ? parsed.variants : null;

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
/*  CORS (only needed when the frontend runs on another port without a proxy) */
/* -------------------------------------------------------------------------- */

if (ALLOW_ORIGIN) {
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", ALLOW_ORIGIN);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    return next();
  });
}

/* -------------------------------------------------------------------------- */
/*  Routes                                                                   */
/* -------------------------------------------------------------------------- */

app.get("/api/health", (req, res) => {
  res.json({ ok: true, hasKey: Boolean(AI_API_KEY), model: AI_MODEL });
});

app.post("/api/generate", async (req, res) => {
  const body = req.body || {};
  const topic = String(body.topic || "").trim();
  const platform = String(body.platform || "instagram");
  const tone = String(body.tone || "friendly");
  const count = Math.min(3, Math.max(1, Number(body.count) || 3));

  if (!topic) {
    return res.status(400).json({ error: "Send a topic for the post." });
  }
  if (topic.length > 400) {
    return res.status(400).json({ error: "Keep the topic under 400 characters." });
  }
  if (!PLATFORMS[platform]) {
    return res.status(400).json({ error: `Unknown platform "${platform}".` });
  }
  if (!TONES[tone]) {
    return res.status(400).json({ error: `Unknown tone "${tone}".` });
  }
  if (!AI_API_KEY) {
    return res.status(503).json({
      error: "No AI key on the server. Add AI_API_KEY to your .env file, then restart the server.",
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);

  try {
    const upstream = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: AI_MODEL,
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
        return res.status(502).json({
          error: `The AI provider rejected your key (${upstream.status}). Check AI_API_KEY in .env and that it matches AI_BASE_URL.`,
        });
      }
      if (upstream.status === 429) {
        return res.status(429).json({
          error: "The AI provider is rate-limiting you or your free quota ran out. Wait a moment or check your provider billing.",
        });
      }
      return res.status(502).json({ error: `AI provider error: ${detail}` });
    }

    const message = payload?.choices?.[0]?.message?.content;
    const content = Array.isArray(message)
      ? message.map((part) => (typeof part === "string" ? part : part?.text || "")).join("")
      : typeof message === "string"
      ? message
      : payload?.choices?.[0]?.text || "";

    const variants = normalizeVariants(content);
    if (variants.length === 0) {
      return res.status(502).json({ error: "The AI returned an empty caption. Try rephrasing the topic." });
    }

    return res.json({
      variants,
      model: AI_MODEL,
      usage: payload?.usage || null,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      return res.status(504).json({ error: "The AI took too long to answer. Try again." });
    }
    const cause = err?.cause?.code || err?.code || "";
    return res.status(502).json({
      error: `Couldn't reach the AI provider${cause ? ` (${cause})` : ""}. Check AI_BASE_URL and your internet connection.`,
    });
  } finally {
    clearTimeout(timeout);
  }
});

app.post("/api/checkout", async (req, res) => {
  const planId = String((req.body || {}).planId || "");
  const plan = PLANS[planId];

  if (!plan) {
    return res.status(400).json({ error: "Unknown plan." });
  }

  /* ---------------------------------------------------------------------- */
  /*  DEMO MODE (default): credit the account, take no money.               */
  /* ---------------------------------------------------------------------- */
  if (!process.env.STRIPE_SECRET_KEY) {
    return res.json({
      demo: true,
      credits: plan.credits,
      message: "Demo checkout — no payment was taken.",
    });
  }

  /* ---------------------------------------------------------------------- */
  /*  REAL PAYMENTS: uncomment after `npm i stripe`.                        */
  /*                                                                        */
  /*  const Stripe = require("stripe");                                     */
  /*  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);                 */
  /*                                                                        */
  /*  const session = await stripe.checkout.sessions.create({               */
  /*    mode: "payment",                                                    */
  /*    line_items: [{                                                      */
  /*      quantity: 1,                                                      */
  /*      price_data: {                                                     */
  /*        currency: "usd",                                                */
  /*        unit_amount: 1900,                     // $19.00                */
  /*        product_data: { name: "Pro — 250 credits" },                    */
  /*      },                                                                */
  /*    }],                                                                 */
  /*    success_url: `${process.env.APP_URL}/?paid=1`,                      */
  /*    cancel_url: `${process.env.APP_URL}/?paid=0`,                       */
  /*    metadata: { planId, credits: String(plan.credits) },                */
  /*  });                                                                   */
  /*  return res.json({ url: session.url });                                */
  /*                                                                        */
  /*  Then add a webhook that credits the user when payment succeeds.       */
  /* ---------------------------------------------------------------------- */

  return res.status(501).json({
    error:
      "Stripe is configured but the checkout route isn't implemented yet. Open server.cjs and follow the commented block.",
  });
});

/* -------------------------------------------------------------------------- */
/*  Optional: serve the production build from this same server               */
/* -------------------------------------------------------------------------- */

const distDir = path.join(__dirname, "dist");
app.use(express.static(distDir));
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(distDir, "index.html"), (err) => {
    if (err) next();
  });
});

app.listen(PORT, () => {
  console.log(`AI proxy listening on http://localhost:${PORT}`);
  console.log(`  model: ${AI_MODEL}`);
  console.log(`  key:   ${AI_API_KEY ? "set" : "MISSING — add AI_API_KEY to .env"}`);
  if (!process.env.STRIPE_SECRET_KEY) console.log("  checkout: demo mode (no Stripe key)");
});
