/**
 * api/auth/[action].js
 * ---------------------------------------------------------------------------
 * One Vercel Function for every /api/auth/* route: signup, login, logout, me,
 * verify and resend. The plan this project deploys on allows twelve functions
 * per deployment, and each file in api/ is one — so the six small account
 * routes share this one and keep their original URLs.
 *
 * The handlers live in api/_lib/routes/ (files under a folder starting with an
 * underscore are never turned into functions), each still a plain
 * (req, res) handler.
 * ---------------------------------------------------------------------------
 */

import { send } from "../_lib/http.js";
import login from "../_lib/routes/login.js";
import logout from "../_lib/routes/logout.js";
import me from "../_lib/routes/me.js";
import resend from "../_lib/routes/resend.js";
import signup from "../_lib/routes/signup.js";
import verify from "../_lib/routes/verify.js";

const ROUTES = { signup, login, logout, me, verify, resend };

export default async function handler(req, res) {
  const raw = req?.query?.action;
  const action = String(Array.isArray(raw) ? raw[0] : raw || "")
    .trim()
    .toLowerCase();

  const route = ROUTES[action];
  if (!route) {
    return send(res, 404, {
      error: `Unknown account action${action ? ` "${action}"` : ""}. Use signup, login, logout, me, verify or resend.`,
    });
  }

  return route(req, res);
}
