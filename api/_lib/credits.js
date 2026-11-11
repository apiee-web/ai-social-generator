/**
 * api/_lib/credits.js
 * ---------------------------------------------------------------------------
 * The one place a paid Stripe Checkout session turns into credits.
 *
 * Two callers use it and both are safe to run in either order:
 *   • /api/stripe/webhook — Stripe's own notification
 *   • /api/stripe/return  — the buyer's way back from Checkout, so a slow or
 *     misconfigured webhook can never swallow someone's money
 *
 * `stripe_session_id` is UNIQUE, and the insert and the balance update happen
 * in a single statement, so a session credits exactly once no matter how many
 * times either route is called (Stripe retries failed deliveries for days).
 * ---------------------------------------------------------------------------
 */

import { randomUUID } from "node:crypto";

import { ensureSchema, query } from "./db.js";

/** Pull the bits we trust out of a Checkout Session Stripe gave us. */
export function readSession(session) {
  return {
    sessionId: String(session?.id || ""),
    userId: String(session?.metadata?.userId || session?.client_reference_id || ""),
    credits: Number(session?.metadata?.credits || 0),
    planId: String(session?.metadata?.planId || "credits"),
    amountCents: Number.isFinite(Number(session?.amount_total)) ? Number(session.amount_total) : null,
  };
}

/** True when Stripe says the money actually arrived. */
export function isPaid(session) {
  if (String(session?.status || "") !== "complete") return false;
  const paymentStatus = String(session?.payment_status || "");
  return paymentStatus === "" || paymentStatus === "paid";
}

/**
 * Add the session's credits to its account, at most once.
 *
 * Resolves to { credited, added, balance }:
 *   credited=false  the session was already used, or the account is gone
 *   credited=true   this call moved the balance
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
        set credits = u.credits + inserted.credits, plan = inserted.plan
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
