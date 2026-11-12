/**
 * api/_lib/auth.js
 * ---------------------------------------------------------------------------
 * Email + password accounts with no third-party auth service:
 *   • passwords are hashed with scrypt (built into Node) and a per-user salt
 *   • the session is a signed, HttpOnly cookie — no token in localStorage, so
 *     page scripts (and XSS) can't read it
 *   • the signature uses SESSION_SECRET; without that secret the server refuses
 *     to hand out sessions rather than signing them with a guessable key
 * ---------------------------------------------------------------------------
 */

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import { ensureSchema, query } from "./db.js";
import { FREE_CREDITS, vaultLimit, isSubscribed } from "./plans.js";

const COOKIE_NAME = "sp_studio_session";
export const SESSION_DAYS = 30;

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };

export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "ConfigError";
    this.status = 503;
  }
}

/* -------------------------------------------------------------------------- */
/*  Input checks                                                             */
/* -------------------------------------------------------------------------- */

export function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function isEmail(value) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/* -------------------------------------------------------------------------- */
/*  Passwords                                                                */
/* -------------------------------------------------------------------------- */

export function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = scryptSync(String(password), salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT.maxmem,
  });
  return [
    "scrypt",
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString("base64"),
    derived.toString("base64"),
  ].join("$");
}

export function verifyPassword(password, stored) {
  try {
    const [scheme, N, r, p, saltB64, hashB64] = String(stored || "").split("$");
    if (scheme !== "scrypt") return false;

    const expected = Buffer.from(hashB64, "base64");
    const derived = scryptSync(String(password), Buffer.from(saltB64, "base64"), expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT.maxmem,
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/*  Session cookies                                                          */
/* -------------------------------------------------------------------------- */

function sessionSecret() {
  const secret = String(process.env.SESSION_SECRET || "").trim();
  if (secret.length < 16) {
    throw new ConfigError(
      "Logins aren't configured yet. Add SESSION_SECRET (any long random string) to your environment variables, then redeploy.",
    );
  }
  return secret;
}

export function signSession(userId, days = SESSION_DAYS) {
  const payload = Buffer.from(
    JSON.stringify({ sub: String(userId), exp: Date.now() + days * 86400000 }),
  ).toString("base64url");
  const signature = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifySessionToken(token) {
  const [payload, signature] = String(token || "").split(".");
  if (!payload || !signature) return null;

  const expected = createHmac("sha256", sessionSecret()).update(payload).digest();
  const given = Buffer.from(signature, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data?.sub || !Number.isFinite(data.exp) || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function parseCookies(req) {
  const header = req?.headers?.cookie || req?.headers?.Cookie || "";
  const jar = {};
  for (const part of String(header).split(";")) {
    const at = part.indexOf("=");
    if (at === -1) continue;
    const name = part.slice(0, at).trim();
    if (!name) continue;
    try {
      jar[name] = decodeURIComponent(part.slice(at + 1).trim());
    } catch {
      jar[name] = part.slice(at + 1).trim();
    }
  }
  return jar;
}

function appendSetCookie(res, value) {
  const existing = res.getHeader?.("Set-Cookie");
  const list = existing ? (Array.isArray(existing) ? existing : [existing]) : [];
  res.setHeader("Set-Cookie", [...list, value]);
}

function isLocalRequest(req) {
  const host = String(req?.headers?.["x-forwarded-host"] || req?.headers?.host || "");
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host.trim());
}

export function setSessionCookie(req, res, token, days = SESSION_DAYS) {
  const secure = isLocalRequest(req) ? "" : "; Secure";
  appendSetCookie(
    res,
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${days * 86400}${secure}`,
  );
}

export function clearSessionCookie(res) {
  appendSetCookie(res, `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/* -------------------------------------------------------------------------- */
/*  Current user                                                             */
/* -------------------------------------------------------------------------- */

/** The signed-in account, or null. Throws ConfigError if logins aren't set up. */
export async function currentUser(req) {
  const token = parseCookies(req)[COOKIE_NAME];
  if (!token) return null;

  const session = verifySessionToken(token);
  if (!session) return null;

  await ensureSchema();
  const { rows } = await query(
    `select id, email, credits, plan, subscription_status, current_period_end, email_verified
       from app_users where id = $1`,
    [session.sub],
  );
  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    credits: Number(row.credits),
    plan: row.plan || "free",
    subscriptionStatus: row.subscription_status || null,
    subscribed: isSubscribed(row.plan, row.subscription_status),
    emailVerified: row.email_verified !== false,
  };
}

/** What the browser is allowed to see. */
export function publicUser(user) {
  const status = user.subscriptionStatus ?? user.subscription_status ?? null;
  return {
    email: user.email,
    credits: Number(user.credits),
    plan: user.plan || "free",
    unlimited: isSubscribed(user.plan, status),
    vaultLimit: vaultLimit(user.plan, status),
    emailVerified: user.emailVerified ?? (user.email_verified !== false),
    freeCredits: FREE_CREDITS,
  };
}
