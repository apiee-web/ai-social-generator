/**
 * api/checkout.js — POST /api/checkout
 * ---------------------------------------------------------------------------
 * Body: { planId: "creator" | "agency", attemptId?: string }.
 *
 * Creates a real monthly Stripe Checkout subscription and returns { url } —
 * the browser follows it. The account switches to unlimited only when Stripe
 * confirms the payment, at /api/stripe/return or /api/stripe/webhook.
 *
 * Real Prices, not inline products: each plan points at a Price created once
 * in the Stripe dashboard (STRIPE_PRICE_CREATOR / STRIPE_PRICE_AGENCY), so
 * revenue reporting stays per-plan instead of one product per click, and the
 * webhook can map a Price back to a plan. A missing Price ID is a configuration
 * error with a message that names the variable, never a silent fallback.
 *
 * Every request carries an idempotency key, so a double click — or a retry
 * after a dropped connection — returns the same Checkout Session instead of
 * opening a second one that could become a second subscription.
 *
 * With no database it falls back to the old demo behaviour, so the page still
 * works before accounts are switched on.
 * ---------------------------------------------------------------------------
 */

import { currentUser } from "./_lib/auth.js";
import { hasDatabase } from "./_lib/db.js";
import { fail, noStore, readBody, resolveOrigin, send } from "./_lib/http.js";
import { getPlan, priceEnvName, priceIdFor } from "./_lib/plans.js";
import { getStripe, hasStripe } from "./_lib/stripe.js";

/* Ten minutes: long enough to collapse a double click or a retry, short enough
   that a deliberate second attempt later still gets a fresh session. */
const IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;

/**
 * Same buyer, same plan, same attempt → same key. Stripe keeps the keyed
 * response for 24 hours, so a retry can never open a second subscription.
 */
export function checkoutIdempotencyKey({ userId, planId, attempt, now = Date.now() } = {}) {
  const safeUser = String(userId || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 48);
  const safeAttempt = String(attempt || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
  const bucket = Math.floor(Number(now) / IDEMPOTENCY_WINDOW_MS);
  return `checkout:${safeUser}:${planId}:${safeAttempt || `w${bucket}`}`;
}

/** The exact payload Stripe receives — split out so it can be tested. */
export function buildCheckoutSession({ plan, priceId, user, origin }) {
  return {
    mode: "subscription",
    customer_email: user.email,
    client_reference_id: user.id,
    allow_promotion_codes: true,
    line_items: [{ quantity: 1, price: priceId }],
    metadata: { userId: user.id, planId: plan.id, kind: "subscription" },
    subscription_data: { metadata: { userId: user.id, planId: plan.id } },
    /* Back through our own server first: it confirms the payment with Stripe
       and upgrades the account before the buyer sees the page, so the plan is
       right even if the webhook is delayed or misconfigured. */
    success_url: `${origin}/api/stripe/return?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/?checkout=cancelled`,
  };
}

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Use POST for this endpoint." });
  }

  try {
    const body = await readBody(req);
    const plan = getPlan(body.planId);
    if (!plan) return send(res, 400, { error: "Unknown plan." });

    /* ---- Before accounts exist: the original no-money demo path ---------- */
    if (!hasDatabase()) {
      return send(res, 200, {
        demo: true,
        planId: plan.id,
        message: "Demo checkout — no payment was taken.",
      });
    }

    if (!hasStripe()) {
      return send(res, 503, {
        error: "Subscriptions aren't switched on yet. Add STRIPE_SECRET_KEY in your hosting settings.",
        code: "stripe_off",
      });
    }

    const priceId = priceIdFor(plan.id);
    if (!priceId) {
      return send(res, 503, {
        error: `Checkout for the ${plan.name} plan isn't configured yet. Add ${priceEnvName(plan.id)} — a Stripe Price ID starting with price_ — to your environment variables, then redeploy.`,
        code: "stripe_price_missing",
        env: priceEnvName(plan.id),
      });
    }

    const user = await currentUser(req);
    if (!user) {
      return send(res, 401, {
        error: "Sign in before subscribing.",
        code: "auth_required",
      });
    }

    /* Never open a second subscription next to a live one — that is how a
       customer ends up charged twice. Plan changes go through the billing
       portal, where Stripe prorates them. */
    if (user.subscribed) {
      return send(res, 409, {
        error:
          user.plan === plan.id
            ? `You're already on the ${plan.name} plan. Use Manage billing to change or cancel it.`
            : "You already have an active subscription. Use Manage billing to switch plans — that avoids a second charge.",
        code: "already_subscribed",
        plan: user.plan || null,
      });
    }

    const origin = resolveOrigin(req);
    if (!origin) {
      return send(res, 500, {
        error: "Couldn't work out this site's address. Set APP_URL in your environment variables.",
      });
    }

    const stripe = await getStripe();
    const idempotencyKey = checkoutIdempotencyKey({
      userId: user.id,
      planId: plan.id,
      attempt: body.attemptId,
    });

    const session = await stripe.checkout.sessions.create(
      buildCheckoutSession({ plan, priceId, user, origin }),
      { idempotencyKey },
    );

    if (!session?.url) {
      return send(res, 502, { error: "Stripe didn't return a checkout link. Try again." });
    }

    return send(res, 200, { url: session.url, planId: plan.id, mode: "subscription" });
  } catch (err) {
    if (err?.type === "StripeAuthenticationError") {
      return send(res, 503, {
        error: "Stripe rejected the API key. Check STRIPE_SECRET_KEY in your environment variables.",
        code: "stripe_bad_key",
      });
    }
    if (err?.type === "StripeInvalidRequestError" && /price/i.test(String(err?.message || ""))) {
      return send(res, 503, {
        error:
          "Stripe doesn't recognise the configured Price ID. Check STRIPE_PRICE_CREATOR and STRIPE_PRICE_AGENCY point at recurring prices in the same Stripe mode (test vs live).",
        code: "stripe_price_invalid",
      });
    }
    if (err?.type === "idempotency_error" || err?.code === "idempotency_key_in_use") {
      return send(res, 409, {
        error: "A checkout is already open for this plan. Give it a moment, then try again.",
        code: "checkout_in_progress",
      });
    }
    return fail(res, err);
  }
}
