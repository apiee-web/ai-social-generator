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
 * Three callers use this and all are safe to run in any order:
 *   • /api/stripe/webhook — Stripe's own notification
 *   • /api/stripe/return  — the buyer's way back from Checkout
 *   • /api/stripe/portal  — "manage billing", which only reads the customer id
 *
 * Plan resolution never trusts metadata alone. A subscription that was created
 * outside /api/checkout (a Payment Link, the Stripe dashboard, a plan switched
 * in the Customer Portal) has no `metadata.planId`, so the plan is read from
 * the Price instead — and when even that is unknown, the account keeps the plan
 * it already has. An active subscriber must never be dropped to "free" because
 * a webhook payload was thin.
 *
 * `stripe_session_id` is UNIQUE, so a session credits exactly once no matter
 * how many times either route runs (Stripe retries failed deliveries for days).
 * Subscription writes are plain updates, so replaying them is harmless.
 * ---------------------------------------------------------------------------
 */

import { randomUUID } from "node:crypto";

import { ensureSchema, query } from "./db.js";
import { PLANS, resolvePlan, subscriptionPrices } from "./plans.js";

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

/* -------------------------------------------------------------------------- */
/*  Subscription state                                                       */
/* -------------------------------------------------------------------------- */

/** Unix seconds, Date, ISO string or null → Date or null. */
function toDate(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null;
  const number = Number(value);
  if (Number.isFinite(number) && number > 0) return new Date(number * 1000);
  return null;
}

/**
 * One idempotent write, matched by subscription id (or customer id for the very
 * first event, before we have stored one).
 *
 * `plan` may be null: that means "resolve failed, keep whatever the account
 * already is" — never a silent downgrade.
 */
async function writeSubscriptionState({ subscriptionId, customerId, plan, status, endsAt }) {
  await ensureSchema();
  const { rows } = await query(
    `update app_users
        set plan = coalesce($1, plan),
            subscription_status = $2,
            current_period_end = coalesce($3, current_period_end),
            stripe_subscription_id = coalesce(nullif($4, ''), stripe_subscription_id)
      where stripe_subscription_id = $4
         or ($5 <> '' and stripe_customer_id = $5)
      returning id, plan, subscription_status`,
    [plan, status, endsAt, subscriptionId || "", customerId || ""],
  );
  return rows;
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
 * Stripe's view of a subscription changed (created, renewed, cancelled, or a
 * payment went past due). The plan comes from metadata, then from the Price.
 */
export async function syncSubscription({ subscription, status, periodEnd } = {}) {
  const data = subscription || {};
  const subscriptionId = String(data.id || "");
  const customerId = String(data.customer || "");
  const state = String(status ?? data.status ?? "");

  if (!subscriptionId && !customerId) {
    return { updated: false, plan: null, status: state, reason: "no_subscription" };
  }

  const alive = state === "active" || state === "trialing";
  const resolved = resolvePlan({
    planId: data.metadata?.planId,
    prices: subscriptionPrices(data),
  });

  /* Alive: use the resolved plan or keep the current one. Dead: free. */
  const plan = alive ? resolved : "free";
  const endsAt = toDate(
    periodEnd ?? data.current_period_end ?? data.items?.data?.[0]?.current_period_end,
  );

  const rows = await writeSubscriptionState({
    subscriptionId,
    customerId,
    plan,
    status: state || "inactive",
    endsAt,
  });

  return {
    updated: rows.length > 0,
    plan: rows[0]?.plan ?? plan,
    status: state || "inactive",
  };
}

/**
 * What an invoice tells us: which subscription it belongs to, which Price was
 * billed, and when that period ends. Handles both the classic top-level
 * `invoice.subscription` and the newer `parent.subscription_details`.
 */
export function invoiceDetails(invoice) {
  const lines = Array.isArray(invoice?.lines?.data) ? invoice.lines.data : [];
  const prices = lines.map((line) => line?.price).filter(Boolean);
  const periodEnds = lines
    .map((line) => Number(line?.period?.end))
    .filter((end) => Number.isFinite(end) && end > 0);

  return {
    invoiceId: String(invoice?.id || ""),
    customerId: String(invoice?.customer || ""),
    subscriptionId: String(
      invoice?.subscription ||
        invoice?.parent?.subscription_details?.subscription ||
        invoice?.subscription_details?.subscription ||
        "",
    ),
    prices,
    plan: resolvePlan({
      planId: prices.map((price) => price?.metadata?.planId).find(Boolean),
      prices,
    }),
    periodEnd: periodEnds.length
      ? new Date(Math.max(...periodEnds) * 1000)
      : toDate(invoice?.period_end),
    billingReason: String(invoice?.billing_reason || ""),
  };
}

/**
 * `invoice.paid` keeps the subscription active and re-syncs the plan;
 * `invoice.payment_failed` marks it past_due so access can pause. An unknown
 * plan never clears one — it just keeps whatever the account already has.
 */
export async function syncInvoice({ invoice, status } = {}) {
  const details = invoiceDetails(invoice);
  /* An invoice without a subscription is a one-off (the retired credit pack).
     It must never touch subscription state, even though it has a customer. */
  if (!details.subscriptionId) {
    return { updated: false, plan: null, status: "", reason: "no_subscription" };
  }

  const nextStatus = String(status || "active");
  const rows = await writeSubscriptionState({
    subscriptionId: details.subscriptionId,
    customerId: details.customerId,
    plan: details.plan,
    status: nextStatus,
    endsAt: details.periodEnd,
  });

  return {
    updated: rows.length > 0,
    plan: rows[0]?.plan ?? details.plan,
    status: nextStatus,
    billingReason: details.billingReason,
  };
}

/** The customer id Stripe knows this account by, if there is one. */
export async function stripeCustomerId(userId) {
  if (!userId) return "";
  await ensureSchema();
  const { rows } = await query("select stripe_customer_id from app_users where id = $1", [userId]);
  return String(rows[0]?.stripe_customer_id || "").trim();
}

/** Remember the customer id so the billing portal can be opened later. */
export async function rememberCustomer(userId, customerId) {
  const id = String(customerId || "").trim();
  if (!userId || !id) return false;
  await ensureSchema();
  await query("update app_users set stripe_customer_id = $2 where id = $1", [userId, id]);
  return true;
}

/* -------------------------------------------------------------------------- */
/*  Legacy one-off credits                                                   */
/* -------------------------------------------------------------------------- */

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
