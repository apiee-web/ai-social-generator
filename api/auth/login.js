/**
 * api/auth/login.js — POST /api/auth/login
 * Body: { email, password }.
 */

import {
  isEmail,
  normalizeEmail,
  publicUser,
  setSessionCookie,
  signSession,
  verifyPassword,
} from "../_lib/auth.js";
import { ensureSchema, query } from "../_lib/db.js";
import { fail, methodNotAllowed, noStore, readBody, send } from "../_lib/http.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return methodNotAllowed(res, "POST");

  try {
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    const password = String(body.password ?? "");

    if (!isEmail(email) || !password) {
      return send(res, 400, { error: "Enter your email and password." });
    }

    await ensureSchema();
    const { rows } = await query(
      "select id, email, credits, plan, password_hash from app_users where email = $1",
      [email],
    );
    const row = rows[0];

    /* Same message either way, so this can't be used to discover emails. */
    if (!row || !verifyPassword(password, row.password_hash)) {
      return send(res, 401, { error: "Email or password is incorrect.", code: "bad_login" });
    }

    await query("update app_users set last_login_at = now() where id = $1", [row.id]);
    setSessionCookie(req, res, signSession(row.id));
    return send(res, 200, { user: publicUser(row) });
  } catch (err) {
    return fail(res, err);
  }
}
