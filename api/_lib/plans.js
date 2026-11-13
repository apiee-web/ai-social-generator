/**
 * api/_lib/plans.js
 * ---------------------------------------------------------------------------
 * Prices live here, on the server. The browser only ever sends a plan id, so
 * nobody can buy the Agency plan for a penny by editing the page.
 *
 * Two recurring plans, both monthly, both unlimited generations:
 *   creator — €19/month, 1 Brand Vault profile
 *   agency  — €49/month, up to 5 Brand Vault profiles
 *
 * Each paid plan maps to one Stripe Price, created once in the Stripe
 * dashboard and referenced by an environment variable. Checkout never invents
 * a product per click, and webhook events can map a price back to a plan:
 *
 *   STRIPE_PRICE_CREATOR=price_…   (€19/month, recurring)
 *   STRIPE_PRICE_AGENCY=price_…    (€49/month, recurring)
 *
 * `cents` is only the number shown in copy and the fallback used when a Price
 * ID is missing — Stripe is the source of truth for what is actually charged.
 *
 * Free accounts get FREE_CREDITS generations and one vault, so the product is
 * usable (and worth upgrading) before anyone pays. The credits only unlock
 * once the address is verified — see api/_lib/verify.js.
 * ---------------------------------------------------------------------------
 */

export const FREE_CREDITS = 5;
export const FREE_VAULTS = 1;

export const PLANS = {
  creator: {
    id: "creator",
    name: "Creator",
    cents: 1900,
    currency: "eur",
    interval: "month",
    vaults: 1,
    tagline: "One brand, every channel",
  },
  agency: {
    id: "agency",
    name: "Agency",
    cents: 4900,
    currency: "eur",
    interval: "month",
    vaults: 5,
    tagline: "Several brands or clients",
  },
};

/** plan id → the env var holding its Stripe Price ID. */
export const PRICE_ENV = {
  creator: "STRIPE_PRICE_CREATOR",
  agency: "STRIPE_PRICE_AGENCY",
};

export function getPlan(planId) {
  return PLANS[String(planId || "").trim().toLowerCase()] || null;
}

export function planSummary(plan) {
  const vaults = `${plan.vaults} brand vault${plan.vaults === 1 ? "" : "s"}`;
  return `${plan.name} — monthly subscription, ${vaults}, unlimited generations`;
}

/* -------------------------------------------------------------------------- */
/*  Stripe prices ←→ plans                                                   */
/* -------------------------------------------------------------------------- */

/** The env var name to tell the operator about when a price is missing. */
export function priceEnvName(planId) {
  return PRICE_ENV[String(planId || "").trim().toLowerCase()] || "";
}

/** The configured Price ID for a plan, or "" when it hasn't been set yet. */
export function priceIdFor(planId) {
  const name = priceEnvName(planId);
  return name ? String(process.env[name] || "").trim() : "";
}

/** Plans whose Price ID is missing — surfaced by checkout as a config error. */
export function plansMissingPrice() {
  return Object.keys(PLANS).filter((planId) => !priceIdFor(planId));
}

/** Which plan does this Price ID belong to? null when it isn't ours. */
export function planForPriceId(priceId) {
  const wanted = String(priceId || "").trim();
  if (!wanted) return null;

  for (const planId of Object.keys(PLANS)) {
    if (priceIdFor(planId) === wanted) return planId;
  }
  return null;
}

/**
 * Which plan does a Stripe Price object belong to? The Price's own metadata
 * wins (so a dashboard-created price can be tagged `planId=creator`), then the
 * configured env vars.
 */
export function planForPrice(price) {
  if (!price || typeof price !== "object") return null;

  const tagged = String(price.metadata?.planId || "").trim().toLowerCase();
  if (PLANS[tagged]) return tagged;

  return planForPriceId(price.id);
}

/** The Price objects attached to a subscription (items on modern API versions). */
export function subscriptionPrices(subscription) {
  const items = subscription?.items?.data;
  if (Array.isArray(items) && items.length > 0) {
    return items.map((item) => item?.price).filter(Boolean);
  }
  return subscription?.plan ? [subscription.plan] : [];
}

/**
 * Best guess at the plan a Stripe object represents:
 *   1. explicit metadata (set by our own checkout)
 *   2. a Price whose metadata says planId
 *   3. a Price ID matching STRIPE_PRICE_*
 * Returns null when nothing matches — callers must then preserve the plan the
 * account already has rather than downgrading a paying customer.
 */
export function resolvePlan({ planId, prices = [], priceIds = [] } = {}) {
  const explicit = PLANS[String(planId || "").trim().toLowerCase()];
  if (explicit) return explicit.id;

  for (const price of prices) {
    const plan = planForPrice(price);
    if (plan) return plan;
  }
  for (const priceId of priceIds) {
    const plan = planForPriceId(priceId);
    if (plan) return plan;
  }
  return null;
}

/** A subscription only counts while Stripe says it is alive. */
export function isSubscribed(planId, status) {
  if (!PLANS[String(planId || "")]) return false;
  const state = String(status || "");
  return state === "active" || state === "trialing";
}

/** How many Brand Vault profiles this account may keep. */
export function vaultLimit(planId, status) {
  if (!isSubscribed(planId, status)) return FREE_VAULTS;
  return PLANS[planId].vaults;
}
