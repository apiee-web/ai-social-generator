/**
 * api/auth/signup.js — POST /api/auth/signup
 * Body: { email, password }.
 *
 * Creates the account signed-in but UNVERIFIED, with the free test credits
 * already on it. The generator stays closed (403) until the address is
 * confirmed — the credits are visible, the lock is the point.
 *
 * Temporary-mailbox domains are refused before anything is written, so one
 * person can't stack free trials on throwaway addresses.
 */

import { randomUUID } from "node:crypto";

import { hashPassword, isEmail, normalizeEmail, publicUser, setSessionCookie, signSession } from "../_lib/auth.js";
import { ensureSchema, query } from "../_lib/db.js";
import { fail, methodNotAllowed, noStore, readBody, resolveOrigin, send } from "../_lib/http.js";
import { sendVerificationEmail } from "../_lib/mail.js";
import { FREE_CREDITS } from "../_lib/plans.js";
import { isDisposableEmail, newVerification } from "../_lib/verify.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return methodNotAllowed(res, "POST");

  try {
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? "");

    if (!isEmail(email)) {
      return send(res, 400, { error: "Enter a valid email address." });
    }
    if (isDisposableEmail(email)) {
      return send(res, 400, {
        error:
          "That looks like a temporary email. Please use a permanent address — the one you actually read — so your credits and plan stay reachable.",
        code: "disposable_email",
      });
    }
    if (password.length < 8) {
      return send(res, 400, { error: "Use at least 8 characters for your password." });
    }
    if (password.length > 200) {
      return send(res, 400, { error: "That password is too long." });
    }

    await ensureSchema();

    const verification = newVerification();

    /* `on conflict do nothing` makes a double-tap on a slow phone harmless. */
    const { rows } = await query(
      `insert into app_users
         (id, email, password_hash, credits, email_verified,
          verification_token, verification_hash, verification_expires, verification_sent_at)
       values ($1, $2, $3, $4, false, $5, $6, $7, now())
       on conflict (email) do nothing
       returning id, email, credits, plan, subscription_status, email_verified`,
      [
        randomUUID(),
        email,
        hashPassword(password),
        FREE_CREDITS,
        verification.token,
        verification.hash,
        verification.expires,
      ],
    );

    if (!rows[0]) {
      return send(res, 409, {
        error: "That email already has an account. Sign in instead.",
        code: "email_taken",
      });
    }

    const user = rows[0];
    setSessionCookie(req, res, signSession(user.id));

    /* The link points back at the page, which posts the token to /api/auth/verify. */
    const origin = resolveOrigin(req);
    const url = `${origin || ""}/?verify=${encodeURIComponent(verification.token)}`;
    const delivery = await sendVerificationEmail({ to: email, url, code: verification.code });

    return send(res, 201, {
      user: publicUser(user),
      verification: {
        required: true,
        expiresInHours: 24,
        sent: delivery.sent,
        /* Only when no mail provider is configured: otherwise the link would
           have to travel back through the browser, which defeats the point. */
        ...(delivery.sent
          ? {}
          : { reason: delivery.reason, url, code: verification.code }),
      },
    });
  } catch (err) {
    return fail(res, err);
  }
}
