/**
 * api/auth/logout.js — POST /api/auth/logout
 * Clears the session cookie. Credits stay on the account.
 */

import { clearSessionCookie } from "../_lib/auth.js";
import { methodNotAllowed, noStore, send } from "../_lib/http.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return methodNotAllowed(res, "POST");

  clearSessionCookie(res);
  return send(res, 200, { ok: true });
}
