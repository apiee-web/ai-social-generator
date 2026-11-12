/**
 * api/stripe/webhook.js — POST /api/stripe/webhook
 * ---------------------------------------------------------------------------
 * Stripe calls this when a subscription starts, renews or ends. The account is
 * also upgraded by /api/stripe/return, so whichever arrives first wins and the
 * other is a no-op (every write here is idempotent).
 *
 * Set this URL in Stripe → Developers → Webhooks:
 *   https://your-site.vercel.app/api/stripe/webhook
 * Events: checkout.session.completed, checkout.session.async_payment_succeeded,
 *         customer.subscription.updated, customer.subscription.deleted
 * The endpoint's "Signing secret" (whsec_…) must be exactly the value of
 * STRIPE_WEBHOOK_SECRET, or every delivery is rejected as unsigned.
 * ---------------------------------------------------------------------------
 */

import { applyCheckoutSession, isPaid, syncSubscription } from "../_lib/credits.js";
import { fail, noStore, readRawBody, send } from "../_lib/http.js";
import { getStripe, stripeWebhookSecret } from "../_lib/stripe.js";

const CHECKOUT_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
]);

const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
]);

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return send(res, 405, { error: "Use POST for this endpoint." });
  }

  try {
    const secret = stripeWebhookSecret();
    const stripe = await getStripe();
    if (!stripe || !secret) {
      return send(res, 503, { error: "Stripe webhooks aren't configured yet." });
    }

    const signature = String(req.headers?.["stripe-signature"] || "");
    if (!signature) return send(res, 400, { error: "Missing Stripe signature." });

    const raw = await readRawBody(req);
    let event;
    try {
      /* Verifies the signature against the exact bytes Stripe sent. */
      event = stripe.webhooks.constructEvent(raw, signature, secret);
    } catch (err) {
      /* rawBytes is what proves the body arrived intact: a mismatch here is
         the signing secret, not the payload. */
      console.warn(
        `[stripe] signature check failed (rawBytes=${raw.length}, secretLen=${secret.length}):`,
        err?.message || err,
      );
      return send(res, 400, { error: "Invalid Stripe signature." });
    }

    /* ---- Subscription lifecycle (renewals, cancellations, failures) ------ */
    if (SUBSCRIPTION_EVENTS.has(event.type)) {
      const subscription = event.data?.object || {};
      const result = await syncSubscription({
        subscriptionId: String(subscription.id || ""),
        customerId: String(subscription.customer || ""),
        planId: String(subscription.metadata?.planId || ""),
        status: String(subscription.status || ""),
        periodEnd: subscription.current_period_end,
      });
      console.log(`[stripe] ${event.type} → plan=${result.plan} status=${result.status}`);
      return send(res, 200, { received: true, ...result });
    }

    if (!CHECKOUT_EVENTS.has(event.type)) {
      return send(res, 200, { received: true, ignored: event.type });
    }

    const session = event.data?.object || {};

    /* Bank debits settle later; wait for async_payment_succeeded for those. */
    if (event.type === "checkout.session.completed" && !isPaid(session)) {
      return send(res, 200, { received: true, pending: true });
    }

    const result = await applyCheckoutSession(session);

    if (result.kind === "subscription") {
      console.log(`[stripe] subscription ${result.planId} active for ${session.client_reference_id}`);
      return send(res, 200, { received: true, plan: result.planId, activated: result.activated });
    }

    return send(res, 200, {
      received: true,
      credited: Boolean(result.credited),
      balance: result.balance ?? null,
    });
  } catch (err) {
    return fail(res, err);
  }
}
