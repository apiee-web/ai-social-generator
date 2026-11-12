/**
 * api/stripe/return.js — GET /api/stripe/return?session_id=cs_…
 * ---------------------------------------------------------------------------
 * This is the Checkout success_url. The buyer lands here before the app, the
 * server confirms the payment with Stripe itself and upgrades the account, and
 * only then are they handed back to the page — so the plan (or credits) is
 * already correct on arrival, and a broken webhook can't swallow a payment.
 *
 * Nothing here may block the buyer: every failure still redirects to the app.
 * ---------------------------------------------------------------------------
 */

import { applyCheckoutSession, isPaid } from "../_lib/credits.js";
import { resolveOrigin } from "../_lib/http.js";
import { getStripe, hasStripe } from "../_lib/stripe.js";

export default async function handler(req, res) {
  const origin = resolveOrigin(req);
  const back = `${origin}/?checkout=success`;

  try {
    const url = new URL(String(req.url || "/"), origin || "http://localhost");
    const sessionId = String(url.searchParams.get("session_id") || "").trim();

    if (hasStripe() && /^cs_[A-Za-z0-9_]+$/.test(sessionId)) {
      const stripe = await getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      if (isPaid(session)) {
        const result = await applyCheckoutSession(session);
        console.log(
          `[stripe] return applied ${result.kind} to ${session.metadata?.userId || session.client_reference_id}`,
        );
      }
    }
  } catch (err) {
    /* Unknown session, Stripe hiccup, missing key — the buyer still lands home
       with the "payment received" notice, and the webhook can still apply it. */
    console.warn("[stripe] return check failed:", err?.message || err);
  }

  res.statusCode = 302;
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Location", back);
  res.end();
}
