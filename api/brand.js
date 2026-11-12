/**
 * api/brand.js — GET / POST / DELETE /api/brand
 * ---------------------------------------------------------------------------
 * The Brand Vault: the handful of facts a user would otherwise retype into
 * every prompt (who they are, who they talk to, what they sell, how they
 * sound). /api/generate reads it automatically.
 *
 *   GET     → { vaults, limit, plan, unlimited }
 *   POST    → { id?, name, audience, offer, tone } → { vault, vaults, limit }
 *   DELETE  → ?id=… → { vaults, limit }
 *
 * The limit comes from the plan: 1 profile on free and Creator, 5 on Agency.
 * It is enforced here, on the server, so the UI can only ever show it.
 * ---------------------------------------------------------------------------
 */

import { randomUUID } from "node:crypto";

import { currentUser } from "./_lib/auth.js";
import { ensureSchema, hasDatabase, query } from "./_lib/db.js";
import { fail, noStore, readBody, send } from "./_lib/http.js";
import { vaultLimit } from "./_lib/plans.js";

const TONES = new Set(["friendly", "bold", "witty", "professional", "inspirational"]);
const MAX_FIELD = 220;

function clean(value, max = MAX_FIELD) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function toVault(row) {
  return {
    id: row.id,
    name: row.name,
    audience: row.audience,
    offer: row.offer,
    tone: row.tone,
    updatedAt: row.updated_at,
  };
}

async function listVaults(userId) {
  const { rows } = await query(
    `select id, name, audience, offer, tone, updated_at
       from brand_vaults where user_id = $1
      order by updated_at desc`,
    [userId],
  );
  return rows.map(toVault);
}

function readId(req) {
  try {
    return new URL(String(req.url || "/"), "http://localhost").searchParams.get("id") || "";
  } catch {
    return "";
  }
}

export default async function handler(req, res) {
  noStore(res);

  if (!hasDatabase()) {
    return send(res, 503, { error: "Accounts aren't connected yet.", code: "accounts_off" });
  }

  try {
    await ensureSchema();

    const user = await currentUser(req);
    if (!user) {
      return send(res, 401, { error: "Sign in to use your Brand Vault.", code: "auth_required" });
    }

    const limit = vaultLimit(user.plan, user.subscriptionStatus);
    const base = { limit, plan: user.plan };

    if (req.method === "GET") {
      return send(res, 200, { ...base, vaults: await listVaults(user.id) });
    }

    if (req.method === "DELETE") {
      const id = readId(req);
      if (!id) return send(res, 400, { error: "Which brand should be removed?" });
      await query("delete from brand_vaults where id = $1 and user_id = $2", [id, user.id]);
      return send(res, 200, { ...base, vaults: await listVaults(user.id) });
    }

    if (req.method === "POST") {
      const body = await readBody(req);
      const name = clean(body.name);
      const audience = clean(body.audience);
      const offer = clean(body.offer);
      const tone = clean(body.tone).toLowerCase() || "friendly";

      if (!name) return send(res, 400, { error: "Add your brand or creator name." });
      if (!audience) return send(res, 400, { error: "Describe who you're talking to." });
      if (!offer) return send(res, 400, { error: "Say what you offer, or your niche." });
      if (!TONES.has(tone)) {
        return send(res, 400, { error: "Pick a tone of voice from the list." });
      }

      const id = clean(body.id, 64);

      if (id) {
        const { rows } = await query(
          `update brand_vaults
              set name = $3, audience = $4, offer = $5, tone = $6, updated_at = now()
            where id = $1 and user_id = $2
            returning id, name, audience, offer, tone, updated_at`,
          [id, user.id, name, audience, offer, tone],
        );
        if (!rows[0]) return send(res, 404, { error: "That brand no longer exists." });
        return send(res, 200, { ...base, vault: toVault(rows[0]), vaults: await listVaults(user.id) });
      }

      const { rows: counted } = await query(
        "select count(*)::int as n from brand_vaults where user_id = $1",
        [user.id],
      );
      if (counted[0].n >= limit) {
        return send(res, 403, {
          error:
            limit === 1
              ? "Your plan holds one brand profile. Upgrade to Agency to keep up to 5."
              : `Your plan holds ${limit} brand profiles. Remove one to add another.`,
          code: "vault_limit",
          limit,
        });
      }

      const { rows } = await query(
        `insert into brand_vaults (id, user_id, name, audience, offer, tone)
         values ($1, $2, $3, $4, $5, $6)
         returning id, name, audience, offer, tone, updated_at`,
        [randomUUID(), user.id, name, audience, offer, tone],
      );
      return send(res, 201, { ...base, vault: toVault(rows[0]), vaults: await listVaults(user.id) });
    }

    res.setHeader("Allow", "GET, POST, DELETE");
    return send(res, 405, { error: "Use GET, POST or DELETE for this endpoint." });
  } catch (err) {
    return fail(res, err);
  }
}
