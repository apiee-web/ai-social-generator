/**
 * api/analyze-voice.js — POST /api/analyze-voice
 * ---------------------------------------------------------------------------
 * Voice DNA: reads two or three posts a person actually wrote and turns them
 * into a short, usable style fingerprint — sentence length, vocabulary, hook
 * patterns, punctuation habits and emotional tone.
 *
 * Body: { vaultId, examplePosts }
 * Saves `example_posts` and the generated `voice_dna` on that Brand Vault and
 * returns the refreshed profile. /api/generate injects the DNA into every
 * prompt, so the imitation happens at writing time, not here.
 *
 * The examples can be Dutch or English (or anything else): the analysis is
 * always written in English so it means the same thing on every account, and
 * the generator is told to take the style, never the language.
 * ---------------------------------------------------------------------------
 */

import { currentUser } from "./_lib/auth.js";
import { aiConfig, chat, extractJson } from "./_lib/ai.js";
import { ensureSchema, hasDatabase, query } from "./_lib/db.js";
import { fail, methodNotAllowed, noStore, readBody, send } from "./_lib/http.js";

const MIN_EXAMPLES = 80;
const MAX_EXAMPLES = 8000;
const MAX_DNA = 1600;

const SYSTEM =
  "You analyse how one specific person writes, so another writer can imitate them exactly. You answer with valid JSON only.";

function buildPrompt(examples) {
  return [
    "Below are posts written by the same person. Describe their writing style so precisely that someone else could produce a new post that reads like them.",
    "",
    "Answer with exactly this JSON object and nothing else:",
    '{"language":"Dutch","sentence_length":"...","vocabulary":"...","hooks":"...","punctuation":"...","emotional_tone":"...","summary":"..."}',
    "",
    '- "language": the language the examples are written in, named in English.',
    '- "sentence_length": typical length and rhythm, e.g. "Short 6-12 word sentences, one long sentence every third line for contrast."',
    '- "vocabulary": word choices to reuse and words they avoid, e.g. "Plain everyday words, trade slang, no corporate jargon; says \'we\' not \'I\'."',
    '- "hooks": how their first line and first three seconds work, e.g. "Opens with a blunt claim or a small confession, never a question."',
    '- "punctuation": habits, e.g. "Em dashes and ellipses, almost no exclamation marks, no emoji."',
    '- "emotional_tone": e.g. "Dry, self-deprecating, quietly confident; never hype."',
    '- "summary": 3-6 short imperative rules a writer can follow, naming the rhythm, the vocabulary, the hook pattern, punctuation, emoji/hashtag habits and emotion. Quote at most two characteristic short phrases verbatim.',
    "",
    "Be specific about THIS writer; never give generic copywriting advice. Write every field in English, even when the posts are in another language.",
    "",
    "THE POSTS:",
    examples,
  ].join("\n");
}

/** Turn the model's JSON into the compact block that gets injected later. */
export function composeVoiceDna(parsed) {
  if (!parsed || typeof parsed !== "object") return "";

  const pick = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  const order = [
    ["Language of the examples", parsed.language],
    ["Sentence length and rhythm", parsed.sentence_length ?? parsed.sentences],
    ["Vocabulary", parsed.vocabulary],
    ["Hook patterns", parsed.hooks ?? parsed.openers],
    ["Punctuation and emoji", parsed.punctuation],
    ["Emotional tone", parsed.emotional_tone ?? parsed.tone],
    ["Rules", parsed.summary],
  ];

  const lines = order
    .map(([label, value]) => [label, pick(value)])
    .filter(([, value]) => value.length > 0)
    .map(([label, value]) => `${label}: ${value}`);

  return lines.join("\n").slice(0, MAX_DNA);
}

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return methodNotAllowed(res, "POST");

  if (!hasDatabase()) {
    return send(res, 503, { error: "Accounts aren't connected yet.", code: "accounts_off" });
  }

  try {
    await ensureSchema();

    const user = await currentUser(req);
    if (!user) {
      return send(res, 401, { error: "Sign in to analyse your writing style.", code: "auth_required" });
    }
    if (!user.emailVerified) {
      return send(res, 403, {
        error: "Verify your email address first — that's what unlocks your free test credits.",
        code: "email_unverified",
      });
    }

    const body = await readBody(req);
    const vaultId = String(body.vaultId || body.id || "").trim();
    const examples = String(body.examplePosts ?? body.example_posts ?? "")
      .replace(/\r\n/g, "\n")
      .trim()
      .slice(0, MAX_EXAMPLES);

    if (!vaultId) return send(res, 400, { error: "Save the brand profile first." });
    if (examples.length < MIN_EXAMPLES) {
      return send(res, 400, {
        error: "Paste a bit more — two or three real posts give us enough to work with.",
        code: "examples_too_short",
      });
    }

    const { rows } = await query(
      "select id, name from brand_vaults where id = $1 and user_id = $2",
      [vaultId, user.id],
    );
    if (!rows[0]) return send(res, 404, { error: "That brand no longer exists." });

    const config = aiConfig();
    if (!config.key) {
      return send(res, 503, {
        error:
          "No AI key on the server. Add AI_API_KEY to your environment variables, then redeploy.",
      });
    }

    const reply = await chat({
      config,
      system: SYSTEM,
      user: buildPrompt(examples),
      maxTokens: 900,
      temperature: 0.4,
      json: true,
    });

    if (!reply.ok) {
      const detail = reply.payload?.error?.message || `Provider returned ${reply.status}.`;
      return send(res, 502, { error: `The AI provider couldn't analyse that: ${detail}` });
    }

    const parsed = extractJson(reply.text);
    const dna = composeVoiceDna(parsed);
    if (!dna) {
      return send(res, 502, {
        error: "The AI sent back an empty style profile. Try again with a post or two more.",
      });
    }

    const saved = await query(
      `update brand_vaults
          set example_posts = $3, voice_dna = $4, voice_dna_at = now(), updated_at = now()
        where id = $1 and user_id = $2
        returning id, name, audience, offer, tone, example_posts, voice_dna, updated_at`,
      [vaultId, user.id, examples, dna],
    );

    const row = saved.rows[0];
    return send(res, 200, {
      vault: {
        id: row.id,
        name: row.name,
        audience: row.audience,
        offer: row.offer,
        tone: row.tone,
        examplePosts: row.example_posts || "",
        voiceDna: row.voice_dna || null,
        updatedAt: row.updated_at,
      },
      voiceDna: dna,
      model: config.model,
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      return send(res, 504, { error: "The analysis took too long. Try again." });
    }
    return fail(res, err);
  }
}

export { buildPrompt as buildVoicePrompt };
