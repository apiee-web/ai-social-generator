/**
 * api/checkout.js — POST /api/checkout
 * ---------------------------------------------------------------------------
 * Body: { planId: "starter" | "pro" | "agency" }.
 *
 * With accounts and STRIPE_SECRET_KEY in place this creates a real Stripe
 * Checkout session and returns { url } — the browser follows it. Credits land
 * on the account when Stripe confirms payment at /api/stripe/webhook, never
 * when the browser merely returns to the success page.
 *
 * With no database it falls back to the old demo behaviour, so the page still
 * works before accounts are switched on.
 * ---------------------------------------------------------------------------
 */

import { currentUser } from "./_lib/auth.js";
import { hasDatabase } from "./_lib/db.js";
import { fail, methodNotAllowed, noStore, readBody, resolveOrigin, send } from "./_lib/http.js";
import { getPlan, planSummary } from "./_lib/plans.js";
import { getStripe, hasStripe } from "./_lib/stripe.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") return methodNotAllowed(res, "POST");

  try {
    const body = await readBody(req);
    const plan = getPlan(body.planId);
    if (!plan) return send(res, 400, { error: "Unknown plan." });

    /* ---- Before accounts exist: the original no-money demo path ---------- */
    if (!hasDatabase()) {
      return send(res, 200, {
        demo: true,
        credits: plan.credits,
        message: "Demo checkout — no payment was taken.",
      });
    }

    if (!hasStripe()) {
      return send(res, 503, {
        error: "Card payments aren't switched on yet. Add STRIPE_SECRET_KEY in your hosting settings.",
        code: "stripe_off",
      });
    }

    const user = await currentUser(req);
    if (!user) {
      return send(res, 401, {
        error: "Sign in before buying credits.",
        code: "auth_required",
      });
    }

    const origin = resolveOrigin(req);
    if (!origin) {
      return send(res, 500, {
        error: "Couldn't work out this site's address. Set APP_URL in your environment variables.",
      });
    }

    const stripe = await getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: user.email,
      client_reference_id: user.id,
      allow_promotion_codes: true,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: plan.cents,
            product_data: { name: planSummary(plan) },
          },
        },
      ],
      metadata: {
        userId: user.id,
        planId: plan.id,
        credits: String(plan.credits),
      },
      success_url: `${origin}/?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?checkout=cancelled`,
    });

    if (!session?.url) {
      return send(res, 502, { error: "Stripe didn't return a checkout link. Try again." });
    }

    return send(res, 200, { url: session.url, planId: plan.id, credits: plan.credits });
  } catch (err) {
    if (err?.type === "StripeAuthenticationError") {
      return send(res, 503, {
        error: "Stripe rejected the API key. Check STRIPE_SECRET_KEY in your environment variables.",
        code: "stripe_bad_key",
      });
    }
    return fail(res, err);
  }
}
