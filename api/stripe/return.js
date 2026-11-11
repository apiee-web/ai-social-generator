/**
 * api/stripe/return.js — GET /api/stripe/return?session_id=cs_…
 * ---------------------------------------------------------------------------
 * This is the Checkout success_url. The buyer used to land on the app first and
 * credits depended entirely on the webhook arriving in time; if the webhook
 * secret was wrong, people paid and never got their credits.
 *
 * So the server confirms the payment with Stripe itself, credits the account,
 * and only then hands the buyer back to the page. The balance is already
 * correct when they arrive, and the webhook (if it works) just adds nothing
 * because the credit is keyed on the Stripe session id.
 *
 * Nothing here may block the buyer: every failure still redirects to the app.
 * ---------------------------------------------------------------------------
 */

import { creditSession, isPaid } from "../_lib/credits.js";
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

      /* Bank debits settle later; the webhook credits those when they clear. */
      if (isPaid(session)) {
        const result = await creditSession(session);
        if (result.credited) {
          console.log(`[stripe] return credited ${result.added} (balance ${result.balance})`);
        }
      }
    }
  } catch (err) {
    /* Unknown session, Stripe hiccup, missing key — the buyer still lands home
       with the "payment received" notice, and the webhook can still credit. */
    console.warn("[stripe] return check failed:", err?.message || err);
  }

  res.statusCode = 302;
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Location", back);
  res.end();
}
