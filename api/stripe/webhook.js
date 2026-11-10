/**
 * api/stripe/webhook.js — POST /api/stripe/webhook
 * ---------------------------------------------------------------------------
 * Stripe calls this after a payment. It is the only place credits are added,
 * which is why the success page can't be faked to mint free credits.
 *
 * Safe to call twice: the purchase row is unique per Stripe session, and the
 * credit is added in the same statement that inserts it. Stripe retries failed
 * deliveries, so that matters.
 *
 * Set this URL in Stripe → Developers → Webhooks:
 *   https://your-site.vercel.app/api/stripe/webhook
 * Events: checkout.session.completed, checkout.session.async_payment_succeeded
 * ---------------------------------------------------------------------------
 */

import { randomUUID } from "node:crypto";

import { ensureSchema, query } from "../_lib/db.js";
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
      console.warn("[stripe] signature check failed:", err?.message || err);
      return send(res, 400, { error: "Invalid Stripe signature." });
    }

    if (!CREDITED_EVENTS.has(event.type)) {
      return send(res, 200, { received: true, ignored: event.type });
    }

    const session = event.data?.object || {};

    /* Bank debits settle later; wait for async_payment_succeeded for those. */
    if (event.type === "checkout.session.completed" && session.payment_status && session.payment_status !== "paid") {
      return send(res, 200, { received: true, pending: true });
    }

    const userId = String(session.metadata?.userId || session.client_reference_id || "");
    const credits = Number(session.metadata?.credits || 0);
    const planId = String(session.metadata?.planId || "credits");
    const sessionId = String(session.id || "");

    if (!userId || !sessionId || !Number.isFinite(credits) || credits <= 0) {
      console.warn("[stripe] session missing usable metadata:", sessionId);
      return send(res, 200, { received: true, credited: false });
    }

    await ensureSchema();

    /* One statement: insert the purchase, and only credit the account if that
       insert actually created a row (so replays add nothing). */
    const { rows } = await query(
      `with inserted as (
         insert into credit_purchases (id, user_id, stripe_session_id, plan, credits, amount_cents)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (stripe_session_id) do nothing
         returning user_id, credits, plan
       )
       update app_users u
          set credits = u.credits + inserted.credits, plan = inserted.plan
         from inserted
        where u.id = inserted.user_id
        returning u.credits, inserted.credits`,
      [
        randomUUID(),
        userId,
        sessionId,
        planId,
        credits,
        Number.isFinite(Number(session.amount_total)) ? Number(session.amount_total) : null,
      ],
    );

    const credited = rows[0];
    if (!credited) {
      /* Already processed, or the account no longer exists. */
      return send(res, 200, { received: true, credited: false, duplicate: true });
    }

    console.log(`[stripe] credited ${credited.credits} to ${userId} (balance ${credited.credits})`);
    return send(res, 200, { received: true, credited: true, balance: Number(credited.credits) });
  } catch (err) {
    return fail(res, err);
  }
}
