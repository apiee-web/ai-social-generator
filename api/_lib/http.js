/**
 * api/_lib/http.js
 * ---------------------------------------------------------------------------
 * Tiny helpers every route needs. No dependencies.
 * ---------------------------------------------------------------------------
 */

export function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

/** Money and account data must never be cached by a browser or a CDN. */
export function noStore(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
}

export function methodNotAllowed(res, method = "POST") {
  res.setHeader("Allow", method);
  return send(res, 405, { error: `Use ${method} for this endpoint.` });
}

/**
 * Vercel usually parses the JSON body for us, but `vercel dev`, Express and
 * plain `node` all differ — so fall back to reading the raw stream.
 */
export async function readBody(req) {
  if (req?.body && typeof req.body === "object") return req.body;
  if (typeof req?.body === "string") {
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
    return JSON.parse(Buffer.concat(chunks.map(toBuffer)).toString("utf8"));
  } catch {
    return {};
  }
}

/**
 * The exact bytes the client sent. Stripe signs the raw payload, so a webhook
 * must never verify against a re-serialised object.
 */
export async function readRawBody(req) {
  if (typeof req?.body === "string") return req.body;
  const chunks = [];
  try {
    for await (const chunk of req) chunks.push(chunk);
  } catch {
    return "";
  }
  return Buffer.concat(chunks.map(toBuffer)).toString("utf8");
}

function toBuffer(chunk) {
  return Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
}

/**
 * Where Stripe sends the buyer back to. APP_URL wins when it is set; otherwise
 * we trust the host Vercel forwarded, with the shape checked so a weird header
 * can't turn the return link into something unexpected.
 */
export function resolveOrigin(req) {
  const configured = String(process.env.APP_URL || "")
    .trim()
    .replace(/\/+$/, "");
  if (configured) return configured;

  const host = String(req?.headers?.["x-forwarded-host"] || req?.headers?.host || "")
    .split(",")[0]
    .trim();
  const proto = String(req?.headers?.["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim();
  if (!/^[a-z0-9.-]+(:\d+)?$/i.test(host)) return "";

  return `${proto === "http" ? "http" : "https"}://${host}`;
}

/** Turn a thrown error into a JSON answer, hiding internals for 500s. */
export function fail(res, err) {
  const status = Number(err?.status) || 500;
  if (status >= 500) console.error("[api]", err?.message || err);
  return send(res, status, {
    error: status === 500 ? "Something went wrong on our side. Try again." : String(err?.message || err),
  });
}
