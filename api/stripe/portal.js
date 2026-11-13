/**
 * api/stripe/portal.js — POST /api/stripe/portal
 * ---------------------------------------------------------------------------
 * Opens the Stripe Customer Portal for the signed-in subscriber: update the
 * card, switch between Creator and Agency, download invoices, cancel.
 *
 * Stripe owns the whole screen, so this endpoint only creates a session and
 * hands back { url }. The browser follows it and comes back to
 * /?billing=return, where the app refreshes the plan.
 *
 * This is a separate function on purpose — it is one more Vercel Function, and
 * the free plan allows twelve, so the total stays at nine. If it ever needs to
 * disappear, fold it into api/checkout.js with an `action` field.
 *
 * The portal has to be switched on once in Stripe → Settings → Billing →
 * Customer portal. Until then the endpoint answers 503 with that instruction
 * instead of a Stripe stack trace.
 * ---------------------------------------------------------------------------
 */

import { currentUser } from "../_lib/auth.js";
import { rememberCustomer, stripeCustomerId } from "../_lib/credits.js";
import { hasDatabase } from "../_lib/db.js";
import { fail, noStore, resolveOrigin, send } from "../_lib/http.js";
import { getStripe, hasStripe } from "../_lib/stripe.js";

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Use POST for this endpoint." });
  }

  try {
    if (!hasDatabase()) {
      return send(res, 503, { error: "Accounts aren't connected yet.", code: "accounts_off" });
    }
    if (!hasStripe()) {
      return send(res, 503, {
        error: "Billing isn't switched on yet. Add STRIPE_SECRET_KEY in your hosting settings.",
        code: "stripe_off",
      });
    }

    const user = await currentUser(req);
    if (!user) {
      return send(res, 401, { error: "Sign in to manage your subscription.", code: "auth_required" });
    }

    const origin = resolveOrigin(req);
    if (!origin) {
      return send(res, 500, {
        error: "Couldn't work out this site's address. Set APP_URL in your environment variables.",
      });
    }

    const stripe = await getStripe();

    /* Prefer the customer we stored at checkout. Accounts that paid before we
       recorded it can still be found by email — Stripe Checkout always creates
       exactly one customer per address. */
    let customerId = await stripeCustomerId(user.id);
    if (!customerId) {
      const found = await stripe.customers.list({ email: user.email, limit: 1 });
      customerId = String(found?.data?.[0]?.id || "");
      if (customerId) await rememberCustomer(user.id, customerId);
    }

    if (!customerId) {
      return send(res, 409, {
        error: "No billing account yet — subscribe first and the portal becomes available.",
        code: "no_customer",
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/?billing=return`,
    });

    if (!session?.url) {
      return send(res, 502, { error: "Stripe didn't return a billing link. Try again." });
    }

    return send(res, 200, { url: session.url });
  } catch (err) {
    if (err?.type === "StripeAuthenticationError") {
      return send(res, 503, {
        error: "Stripe rejected the API key. Check STRIPE_SECRET_KEY in your environment variables.",
        code: "stripe_bad_key",
      });
    }
    if (
      err?.code === "billing_portal_configuration_not_found" ||
      /billing portal|portal configuration|no configuration provided/i.test(String(err?.message || ""))
    ) {
      return send(res, 503, {
        error:
          "The billing portal isn't switched on in Stripe yet. Activate it under Settings → Billing → Customer portal, then try again.",
        code: "portal_off",
      });
    }
    return fail(res, err);
  }
}
