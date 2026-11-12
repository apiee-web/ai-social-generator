/**
 * api/_lib/credits.js
 * ---------------------------------------------------------------------------
 * Everything that turns money into access, in one place, safely repeatable.
 *
 *   • subscriptions — Creator / Agency switch the account to unlimited and set
 *     how many Brand Vault profiles it may keep
 *   • one-off credits — the older credit path is still honoured for any
 *     purchase that used it
 *
 * Two callers use this and both are safe to run in either order:
 *   • /api/stripe/webhook — Stripe's own notification
 *   • /api/stripe/return  — the buyer's way back from Checkout
 *
 * `stripe_session_id` is UNIQUE, so a session credits exactly once no matter
 * how many times either route runs (Stripe retries failed deliveries for days).
 * ---------------------------------------------------------------------------
 */

import { randomUUID } from "node:crypto";

import { ensureSchema, query } from "./db.js";
import { PLANS } from "./plans.js";

/** Pull the bits we trust out of a Checkout Session Stripe gave us. */
export function readSession(session) {
  return {
    sessionId: String(session?.id || ""),
    mode: String(session?.mode || "payment"),
    userId: String(session?.metadata?.userId || session?.client_reference_id || ""),
    planId: String(session?.metadata?.planId || "credits"),
    credits: Number(session?.metadata?.credits || 0),
    amountCents: Number.isFinite(Number(session?.amount_total)) ? Number(session.amount_total) : null,
    subscriptionId: session?.subscription ? String(session.subscription) : "",
    customerId: session?.customer ? String(session.customer) : "",
  };
}

/** True when Stripe says the money actually arrived. */
export function isPaid(session) {
  const status = String(session?.status || "");
  if (session?.mode === "subscription") {
    /* A subscription checkout is complete once the session completed; card
       failures surface as status "expired"/"open", not "complete". */
    return status === "complete";
  }
  if (status !== "complete") return false;
  const paymentStatus = String(session?.payment_status || "");
  return paymentStatus === "" || paymentStatus === "paid";
}

/**
 * Switch the account onto a subscription plan.
 * Safe to repeat: it just rewrites the same state.
 */
export async function activateSubscription(session) {
  const { userId, planId, subscriptionId, customerId } = readSession(session);
  if (!userId || !PLANS[planId]) return { activated: false, reason: "incomplete" };

  await ensureSchema();
  const { rows } = await query(
    `update app_users
        set plan = $2,
            subscription_status = 'active',
            stripe_customer_id = coalesce(nullif($3, ''), stripe_customer_id),
            stripe_subscription_id = coalesce(nullif($4, ''), stripe_subscription_id)
      where id = $1
      returning plan, subscription_status`,
    [userId, planId, customerId, subscriptionId],
  );

  if (!rows[0]) return { activated: false, reason: "no_user" };
  return { activated: true, planId, plan: rows[0].plan };
}

/**
 * Stripe's view of a subscription changed (renewed, cancelled, payment failed).
 * Matched by subscription id, or by customer id for the first update.
 */
export async function syncSubscription({ subscriptionId, customerId, planId, status, periodEnd }) {
  if (!subscriptionId && !customerId) return { updated: false };

  const state = String(status || "");
  const alive = state === "active" || state === "trialing";
  const plan = alive && PLANS[planId] ? planId : "free";
  const endsAt = Number.isFinite(Number(periodEnd)) && Number(periodEnd) > 0
    ? new Date(Number(periodEnd) * 1000)
    : null;

  await ensureSchema();
  const { rows } = await query(
    `update app_users
        set plan = $1,
            subscription_status = $2,
            current_period_end = $3,
            stripe_subscription_id = coalesce(nullif($4, ''), stripe_subscription_id)
      where stripe_subscription_id = $4
         or ($5 <> '' and stripe_customer_id = $5)
      returning id, plan, subscription_status`,
    [plan, state || "inactive", endsAt, subscriptionId || "", customerId || ""],
  );
  return { updated: rows.length > 0, plan, status: state };
}

/**
 * Add one-off credits to an account, at most once per Stripe session.
 * Legacy path: the app now sells subscriptions, but old sessions still count.
 */
export async function creditSession(session) {
  const { sessionId, userId, credits, planId, amountCents } = readSession(session);

  if (!sessionId || !userId || !Number.isFinite(credits) || credits <= 0) {
    return { credited: false, added: 0, balance: null, reason: "incomplete" };
  }

  await ensureSchema();

  const { rows } = await query(
    `with inserted as (
       insert into credit_purchases (id, user_id, stripe_session_id, plan, credits, amount_cents)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (stripe_session_id) do nothing
       returning user_id, credits, plan
     )
     update app_users u
        set credits = u.credits + inserted.credits
       from inserted
      where u.id = inserted.user_id
      returning u.credits as balance, inserted.credits as added`,
    [randomUUID(), userId, sessionId, planId, credits, amountCents],
  );

  const row = rows[0];
  if (!row) {
    /* Already credited, or the account was deleted while the money was moving. */
    return { credited: false, added: 0, balance: null, reason: "duplicate" };
  }

  return { credited: true, added: Number(row.added), balance: Number(row.balance) };
}

/** One entry point for "Stripe told us this session finished". */
export async function applyCheckoutSession(session) {
  const { mode, planId } = readSession(session);
  if (mode === "subscription") {
    const result = await activateSubscription(session);
    return { kind: "subscription", ...result };
  }
  const result = await creditSession(session);
  return { kind: "credits", planId, ...result };
}
