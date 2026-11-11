/**
 * api/stripe/webhook.js — POST /api/stripe/webhook
 * ---------------------------------------------------------------------------
 * Stripe calls this after a payment. Credits are added here or by
 * /api/stripe/return (whichever lands first) — never by the page itself, so
 * the page can't be faked to mint free credits.
 *
 * Safe to call twice: the purchase row is unique per Stripe session, and the
 * credit is added in the same statement that inserts it. Stripe retries failed
 * deliveries, so that matters.
 *
 * Set this URL in Stripe → Developers → Webhooks:
 *   https://your-site.vercel.app/api/stripe/webhook
 * Events: checkout.session.completed, checkout.session.async_payment_succeeded
 * The endpoint's "Signing secret" (whsec_…) must be exactly the value of
 * STRIPE_WEBHOOK_SECRET, or every delivery is rejected as unsigned.
 * ---------------------------------------------------------------------------
 */

import { creditSession, isPaid } from "../_lib/credits.js";
import { fail, noStore, readRawBody, send } from "../_lib/http.js";
import { getStripe, stripeWebhookSecret } from "../_lib/stripe.js";

const CREDITED_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
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

    if (!CREDITED_EVENTS.has(event.type)) {
      return send(res, 200, { received: true, ignored: event.type });
    }

    const session = event.data?.object || {};

    /* Bank debits settle later; wait for async_payment_succeeded for those. */
    if (event.type === "checkout.session.completed" && !isPaid(session)) {
      return send(res, 200, { received: true, pending: true });
    }

    const result = await creditSession(session);

    if (!result.credited) {
      /* Already processed by this route or by /api/stripe/return, or the
         account no longer exists. */
      return send(res, 200, {
        received: true,
        credited: false,
        duplicate: result.reason === "duplicate",
      });
    }

    console.log(
      `[stripe] webhook credited ${result.added} to ${session.metadata?.userId || session.client_reference_id} (balance ${result.balance})`,
    );
    return send(res, 200, { received: true, credited: true, balance: result.balance });
  } catch (err) {
    return fail(res, err);
  }
}
