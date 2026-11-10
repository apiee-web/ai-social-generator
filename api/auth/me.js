/**
 * api/auth/me.js — GET /api/auth/me
 * Who is signed in, and how many credits they have left.
 *
 * Returns 503 when accounts aren't configured. The page reads that as "guest
 * mode" and keeps working, so a half-configured deploy never looks broken.
 */

import { currentUser, publicUser } from "../_lib/auth.js";
import { hasDatabase } from "../_lib/db.js";
import { fail, methodNotAllowed, noStore, send } from "../_lib/http.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "GET") return methodNotAllowed(res, "GET");

  if (!hasDatabase()) {
    return send(res, 503, {
      error: "Accounts aren't connected yet.",
      code: "accounts_off",
    });
  }

  try {
    const user = await currentUser(req);
    return send(res, 200, { user: user ? publicUser(user) : null });
  } catch (err) {
    /* A missing SESSION_SECRET lands here too: keep the app usable. */
    if (err?.status === 503) {
      return send(res, 503, { error: err.message, code: "accounts_off" });
    }
    return fail(res, err);
  }
}
