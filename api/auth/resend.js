/**
 * api/auth/resend.js — POST /api/auth/resend
 * Body: { email } (defaults to the signed-in account).
 *
 * Issues a fresh token + code and emails it again. One request per minute per
 * account, so the button can't be used to spray someone else's inbox.
 * Answers 200 either way, so it can't be used to discover which emails exist.
 */

import { currentUser, normalizeEmail } from "../_lib/auth.js";
import { ensureSchema, query } from "../_lib/db.js";
import { fail, methodNotAllowed, noStore, readBody, resolveOrigin, send } from "../_lib/http.js";
import { sendVerificationEmail } from "../_lib/mail.js";
import { RESEND_COOLDOWN_SECONDS, newVerification } from "../_lib/verify.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return methodNotAllowed(res, "POST");

  try {
    const body = await readBody(req);
    let email = normalizeEmail(body.email);

    if (!email) {
      const user = await currentUser(req);
      email = user?.email || "";
    }
    if (!email) return send(res, 200, { ok: true, sent: false });

    await ensureSchema();
    const { rows } = await query(
      `select id, email, email_verified, verification_sent_at from app_users where email = $1`,
      [email],
    );
    const row = rows[0];

    /* Unknown or already verified: same friendly answer, nothing sent. */
    if (!row || row.email_verified) {
      return send(res, 200, { ok: true, sent: false, alreadyVerified: Boolean(row?.email_verified) });
    }

    const lastSent = row.verification_sent_at ? new Date(row.verification_sent_at).getTime() : 0;
    const waited = Math.floor((Date.now() - lastSent) / 1000);
    if (lastSent && waited < RESEND_COOLDOWN_SECONDS) {
      return send(res, 429, {
        error: `Give it ${RESEND_COOLDOWN_SECONDS - waited} more seconds before asking for another email.`,
        retryAfter: RESEND_COOLDOWN_SECONDS - waited,
      });
    }

    const verification = newVerification();
    await query(
      `update app_users
          set verification_token = $2,
              verification_hash = $3,
              verification_expires = $4,
              verification_sent_at = now()
        where id = $1`,
      [row.id, verification.token, verification.hash, verification.expires],
    );

    const origin = resolveOrigin(req);
    const url = `${origin || ""}/?verify=${encodeURIComponent(verification.token)}`;
    const delivery = await sendVerificationEmail({ to: email, url, code: verification.code });

    return send(res, 200, {
      ok: true,
      sent: delivery.sent,
      retryAfter: RESEND_COOLDOWN_SECONDS,
      ...(delivery.sent ? {} : { reason: delivery.reason, url, code: verification.code }),
    });
  } catch (err) {
    return fail(res, err);
  }
}
