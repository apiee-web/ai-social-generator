/**
 * api/auth/signup.js — POST /api/auth/signup
 * Body: { email, password }. Creates the account, signs the user in.
 */

import { randomUUID } from "node:crypto";

import { hashPassword, isEmail, normalizeEmail, publicUser, setSessionCookie, signSession } from "../_lib/auth.js";
import { ensureSchema, query } from "../_lib/db.js";
import { fail, methodNotAllowed, noStore, readBody, send } from "../_lib/http.js";
import { FREE_CREDITS } from "../_lib/plans.js";

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
    if (password.length < 8) {
      return send(res, 400, { error: "Use at least 8 characters for your password." });
    }
    if (password.length > 200) {
      return send(res, 400, { error: "That password is too long." });
    }

    await ensureSchema();

    /* `on conflict do nothing` makes a double-tap on a slow phone harmless. */
    const { rows } = await query(
      `insert into app_users (id, email, password_hash, credits)
       values ($1, $2, $3, $4)
       on conflict (email) do nothing
       returning id, email, credits, plan`,
      [randomUUID(), email, hashPassword(password), FREE_CREDITS],
    );

    if (!rows[0]) {
      return send(res, 409, {
        error: "That email already has an account. Sign in instead.",
        code: "email_taken",
      });
    }

    setSessionCookie(req, res, signSession(rows[0].id));
    return send(res, 201, { user: publicUser(rows[0]) });
  } catch (err) {
    return fail(res, err);
  }
}
