/**
 * api/_lib/routes/verify.js — POST /api/auth/verify
 * Body: { token } from the emailed link, or { email, code } from the email.
 *
 * Marks the address confirmed, clears the pending token/code and signs the
 * person in, so a link click lands them on a working generator.
 */

import { isEmail, normalizeEmail, publicUser, setSessionCookie, signSession } from "../auth.js";
import { ensureSchema, query } from "../db.js";
import { fail, methodNotAllowed, noStore, readBody, send } from "../http.js";
import { codeMatches } from "../verify.js";

const COLUMNS =
  "id, email, credits, plan, subscription_status, current_period_end, email_verified, verification_hash";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return methodNotAllowed(res, "POST");

  try {
    const body = await readBody(req);
    const token = String(body.token || "").trim();
    const email = normalizeEmail(body.email);
    const code = String(body.code || "").trim();

    if (!token && !(isEmail(email) && code)) {
      return send(res, 400, {
        error: "Open the link from the email, or enter the six-digit code.",
      });
    }

    await ensureSchema();

    const { rows } = token
      ? await query(
          `select ${COLUMNS} from app_users
            where verification_token = $1 and verification_expires > now()`,
          [token],
        )
      : await query(
          `select ${COLUMNS} from app_users
            where email = $1 and verification_expires > now()`,
          [email],
        );

    const row = rows[0];
    const valid = row && (token || codeMatches(code, row.verification_hash));
    if (!valid) {
      return send(res, 400, {
        error: "That verification link or code is wrong or has expired. Request a new email.",
        code: "bad_verification",
      });
    }

    const confirmed = await query(
      `update app_users
          set email_verified = true,
              verification_token = null,
              verification_hash = null,
              verification_expires = null,
              verification_sent_at = null
        where id = $1
        returning ${COLUMNS}`,
      [row.id],
    );

    const user = confirmed.rows[0];
    setSessionCookie(req, res, signSession(user.id));
    return send(res, 200, { user: publicUser(user), verified: true });
  } catch (err) {
    return fail(res, err);
  }
}
