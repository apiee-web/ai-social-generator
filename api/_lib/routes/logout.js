/**
 * api/_lib/routes/logout.js — POST /api/auth/logout
 * Clears the session cookie. Credits stay on the account.
 */

import { clearSessionCookie } from "../auth.js";
import { methodNotAllowed, noStore, send } from "../http.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return methodNotAllowed(res, "POST");

  clearSessionCookie(res);
  return send(res, 200, { ok: true });
}
